from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent.graph import GraphAgent
from app.agent.nodes import AgentNodes
from app.agent.state import GraphState
from app.config import Settings, get_settings
from app.ingest.llama_pipeline import LlamaIngestionPipeline
from app.ingest.symbol_graph_builder import SymbolGraphBuilder
from app.llm_factory import DummyEmbeddings, LLMRuntime, build_runtime
from app.schemas import ChatRequest, ChatResponse, IngestRequest, IngestResponse, PathRequest, PathResponse, SuggestResponse
from app.search.hybrid_search import HybridSearcher
from app.search.suggest import SymbolSuggester
from app.session_store import SessionStore
from app.stores.bm25_store import BM25Store
from app.stores.chroma_store import ChromaSymbolStore
from app.stores.kuzu_store import KuzuGraphStore
from app.stores.repo_registry import RepoRegistry
from app.tools.call_path_tool import CallPathTool
from app.tools.expand_graph_tool import ExpandGraphTool
from app.tools.retrieve_tool import RetrieveTool
from app.tools.symbol_suggest_tool import SymbolSuggestTool


class RuntimeContext:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.runtime: LLMRuntime = build_runtime(settings)
        self.registry = RepoRegistry(settings.registry_file)
        self.session_store = SessionStore(settings.session_file)
        self.llama_pipeline = LlamaIngestionPipeline(settings.ingest_root)
        self.symbol_builder = SymbolGraphBuilder()

        self.bm25_store = BM25Store(settings.bm25_root)
        self.chroma_store = ChromaSymbolStore(settings.chroma_root, self.runtime.embeddings)
        self._kuzu_cache: dict[str, KuzuGraphStore] = {}

    def _repo_kuzu_path(self, repo_id: str) -> Path:
        repo_dir = self.settings.kuzu_root / repo_id
        repo_dir.mkdir(parents=True, exist_ok=True)
        return repo_dir / "graph.kuzu"

    def kuzu_store(self, repo_id: str) -> KuzuGraphStore:
        if repo_id not in self._kuzu_cache:
            self._kuzu_cache[repo_id] = KuzuGraphStore(self._repo_kuzu_path(repo_id))
        return self._kuzu_cache[repo_id]

    def build_agent(self, repo_id: str) -> GraphAgent:
        kuzu = self.kuzu_store(repo_id)
        searcher = HybridSearcher(chroma_store=self.chroma_store, bm25_store=self.bm25_store, rrf_k=self.settings.rrf_k)
        suggester = SymbolSuggester(kuzu_store=kuzu, session_store=self.session_store)
        nodes = AgentNodes(
            runtime=self.runtime,
            retrieve_tool=RetrieveTool(searcher=searcher, kuzu_store=kuzu),
            expand_graph_tool=ExpandGraphTool(kuzu_store=kuzu),
            call_path_tool=CallPathTool(kuzu_store=kuzu, suggester=suggester),
            symbol_suggest_tool=SymbolSuggestTool(suggester=suggester),
            session_store=self.session_store,
        )
        return GraphAgent(nodes=nodes)

    def ingest(self, req: IngestRequest) -> IngestResponse:
        repo_path = self.resolve_repo_path(req.repo_path)
        repo_id = self.registry.get_or_create_repo_id(str(repo_path))

        chunks = self.llama_pipeline.run(
            repo_id=repo_id,
            repo_path=repo_path,
            include_globs=req.include_globs,
            exclude_globs=req.exclude_globs,
            languages=req.languages,
        )
        file_chunk_map: dict[str, list[str]] = defaultdict(list)
        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            file_path = str(metadata.get("file_path", ""))
            file_chunk_map[file_path].append(str(chunk.get("text", "")))

        symbols, edges = self.symbol_builder.build(
            repo_id=repo_id,
            repo_root=repo_path,
            include_globs=req.include_globs,
            exclude_globs=req.exclude_globs,
            languages=req.languages,
        )

        kuzu = self.kuzu_store(repo_id)
        kuzu.clear_repo(repo_id)
        kuzu.upsert_graph(symbols=symbols, edges=edges)

        self.chroma_store.reset_repo(repo_id)
        self.bm25_store.reset_repo(repo_id)

        text_map: dict[str, str] = {}
        for symbol in symbols:
            base = self.symbol_builder.symbol_to_document_text(symbol)
            chunks_for_file = "\n".join(file_chunk_map.get(symbol.file_path, [])[:2])
            text_map[symbol.id] = f"{base}\n{chunks_for_file}".strip()

        try:
            self.chroma_store.index_symbols(repo_id=repo_id, symbols=symbols, text_map=text_map)
        except Exception:
            # Some OpenAI-compatible providers reject embedding payload variants.
            # Degrade gracefully so ingest remains available.
            self.chroma_store = ChromaSymbolStore(self.settings.chroma_root, DummyEmbeddings())
            self.chroma_store.reset_repo(repo_id)
            self.chroma_store.index_symbols(repo_id=repo_id, symbols=symbols, text_map=text_map)
        self.bm25_store.index_symbols(repo_id=repo_id, symbols=symbols, text_map=text_map)

        symbol_count, edge_count = kuzu.count_repo(repo_id)
        return IngestResponse(
            repo_id=repo_id,
            symbols=symbol_count,
            edges=edge_count,
            kuzu_path=str(self._repo_kuzu_path(repo_id)),
            chroma_path=str(self.settings.chroma_root / repo_id),
        )

    def resolve_repo_path(self, repo_path: str) -> Path:
        p = Path(repo_path)
        if p.exists():
            return p

        candidate = Path(self.settings.mounted_repo_root) / p.name
        if candidate.exists():
            return candidate

        if repo_path.startswith("/repo/") and Path(repo_path).exists():
            return Path(repo_path)

        raise HTTPException(status_code=400, detail=f"repo_path not found in container: {repo_path}")

    def ensure_repo_known(self, repo_id: str) -> None:
        if not self.registry.get_repo_path(repo_id):
            raise HTTPException(status_code=404, detail=f"Unknown repo_id: {repo_id}")

    def run_chat(self, req: ChatRequest) -> dict[str, Any]:
        self.ensure_repo_known(req.repo_id)
        agent = self.build_agent(req.repo_id)
        history = self.session_store.get_history(req.session_id)

        state: GraphState = {
            "messages": history,
            "history": history,
            "user_message": req.message,
            "repo_id": req.repo_id,
            "session_id": req.session_id,
            "selected_symbol": req.selected_symbol,
            "top_k": req.top_k or self.settings.default_top_k,
            "graph_depth": req.graph_depth or self.settings.default_graph_depth,
            "hybrid": req.hybrid,
            "max_hops": 10,
            "retrieved_symbols": [],
            "expanded_symbols": [],
            "path_result": None,
            "context_pack": [],
            "used_retrieval": False,
            "used_graph": False,
            "used_path": False,
            "citations": [],
            "symbol_candidates": [],
            "attempts": 0,
            "max_attempts": self.settings.max_verify_attempts,
            "trace": {"nodes": []},
            "disambiguation": None,
        }

        result = agent.run(state)
        citations = result.get("citations", [])
        trace = json.loads(json.dumps(result.get("trace", {}), ensure_ascii=False))

        recent_symbols = [c["symbol"] for c in citations if c.get("symbol")]
        if recent_symbols:
            self.session_store.add_recent_symbols(req.session_id, recent_symbols)
        self.session_store.append_message(req.session_id, "user", req.message)
        self.session_store.append_message(req.session_id, "assistant", result.get("answer", ""))

        return {
            "answer": result.get("answer", "不确定/缺少资料：未能生成回答。"),
            "citations": citations,
            "used_retrieval": bool(result.get("used_retrieval", False)),
            "used_graph": bool(result.get("used_graph", False)),
            "used_path": bool(result.get("used_path", False)),
            "trace": trace,
            "disambiguation": result.get("disambiguation"),
        }


settings = get_settings()
ctx = RuntimeContext(settings=settings)
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "fake_mode": ctx.runtime.is_fake,
        "chat_model": settings.effective_chat_model,
        "base_url": settings.llm_base_url,
    }


@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest) -> IngestResponse:
    return ctx.ingest(req)


@app.get("/symbols/suggest", response_model=SuggestResponse)
def symbols_suggest(
    repo_id: str = Query(...),
    q: str = Query(...),
    mode: str = Query(default="fuzzy"),
    top_n: int = Query(default=10),
    session_id: str | None = Query(default=None),
) -> SuggestResponse:
    ctx.ensure_repo_known(repo_id)
    kuzu = ctx.kuzu_store(repo_id)
    suggester = SymbolSuggester(kuzu_store=kuzu, session_store=ctx.session_store)
    normalized_mode = "prefix" if mode == "prefix" else "fuzzy"
    candidates = suggester.suggest(repo_id=repo_id, query=q, mode=normalized_mode, top_n=top_n, session_id=session_id)
    return SuggestResponse(query=q, mode=normalized_mode, candidates=candidates)


@app.post("/path", response_model=PathResponse)
def path_search(req: PathRequest) -> PathResponse:
    ctx.ensure_repo_known(req.repo_id)
    kuzu = ctx.kuzu_store(req.repo_id)
    suggester = SymbolSuggester(kuzu_store=kuzu, session_store=ctx.session_store)
    tool = CallPathTool(kuzu_store=kuzu, suggester=suggester)
    result = tool.run(
        repo_id=req.repo_id,
        from_symbol=req.from_symbol,
        to_symbol=req.to_symbol,
        max_hops=req.max_hops,
        session_id=req.session_id,
    )
    trace = {"route": "CallPath", "nodes": ["call_path_tool"], "disambiguation": result.get("disambiguation")}
    return PathResponse(
        found=bool(result.get("found")),
        path=result.get("path", []),
        citations=result.get("citations", []),
        explain=result.get("explain", ""),
        trace=trace,
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    return ChatResponse(**ctx.run_chat(req))


def _sse_event(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, chunk_size: int = 8) -> list[str]:
    if not text:
        return []
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    async def event_generator():
        try:
            result = ctx.run_chat(req)
            yield _sse_event("trace_update", {"trace": result.get("trace", {})})
            yield _sse_event("citations_update", {"citations": result.get("citations", [])})
            for token in _chunk_text(str(result.get("answer", "")), chunk_size=8):
                yield _sse_event("token", {"token": token})
                await asyncio.sleep(0.012)
            yield _sse_event("done", result)
        except Exception as exc:  # pragma: no cover - defensive error channel for UI
            yield _sse_event("error", {"message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
