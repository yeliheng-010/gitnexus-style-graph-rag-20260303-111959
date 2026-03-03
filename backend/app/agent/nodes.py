from __future__ import annotations

import re
from typing import Any

from app.agent.router import route_message
from app.agent.state import GraphState
from app.llm_factory import LLMRuntime
from app.session_store import SessionStore
from app.tools.call_path_tool import CallPathTool
from app.tools.expand_graph_tool import ExpandGraphTool
from app.tools.retrieve_tool import RetrieveTool
from app.tools.symbol_suggest_tool import SymbolSuggestTool


class AgentNodes:
    def __init__(
        self,
        runtime: LLMRuntime,
        retrieve_tool: RetrieveTool,
        expand_graph_tool: ExpandGraphTool,
        call_path_tool: CallPathTool,
        symbol_suggest_tool: SymbolSuggestTool,
        session_store: SessionStore,
    ) -> None:
        self.runtime = runtime
        self.retrieve_tool = retrieve_tool
        self.expand_graph_tool = expand_graph_tool
        self.call_path_tool = call_path_tool
        self.symbol_suggest_tool = symbol_suggest_tool
        self.session_store = session_store

    def router_node(self, state: GraphState) -> GraphState:
        route = route_message(self.runtime, state.get("user_message", ""))
        retrieval_mode = "hybrid" if state.get("hybrid", True) else "semantic"
        if route in {"direct_answer", "CallPath"}:
            retrieval_mode = "none"
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("router")
        trace["route"] = route
        trace["retrieval_mode"] = retrieval_mode
        state["route"] = route  # type: ignore[assignment]
        state["retrieval_mode"] = retrieval_mode  # type: ignore[assignment]
        state["trace"] = trace
        return state

    def symbol_suggest_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("symbol_suggest_tool")

        message = state.get("user_message", "").strip()
        session_id = state.get("session_id", "")
        repo_id = state["repo_id"]
        selected_symbol = state.get("selected_symbol")

        if selected_symbol:
            state["disambiguation"] = {
                "needs_user_choice": False,
                "resolved": selected_symbol,
                "candidates": [],
            }
            trace["disambiguation"] = state["disambiguation"]
            state["trace"] = trace
            return state

        symbol_hint = self._extract_symbol_hint(message)
        disambiguation = self.symbol_suggest_tool.disambiguate(
            repo_id=repo_id, query=symbol_hint, session_id=session_id, top_n=10
        )
        state["disambiguation"] = disambiguation
        state["symbol_candidates"] = disambiguation.get("candidates", [])
        trace["disambiguation"] = disambiguation
        state["trace"] = trace
        return state

    def retrieve_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("retrieve_tool")
        state["used_retrieval"] = True

        query = state.get("rewritten_query") or state.get("user_message", "")
        disambiguation = state.get("disambiguation") or {}
        if disambiguation.get("resolved"):
            query = str(disambiguation["resolved"])

        repo_id = state["repo_id"]
        top_k = int(state.get("top_k", 8))
        hybrid = bool(state.get("hybrid", True))
        hits = self.retrieve_tool.run(repo_id=repo_id, query=query, top_k=top_k, hybrid=hybrid)
        state["retrieved_symbols"] = hits
        state["context_pack"] = list(hits)
        state["trace"] = trace
        return state

    def expand_graph_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("expand_graph_tool")
        repo_id = state["repo_id"]
        depth = int(state.get("graph_depth", 2))
        seed = state.get("retrieved_symbols", [])
        expanded = self.expand_graph_tool.run(repo_id=repo_id, seed_symbols=seed, depth=depth)
        state["expanded_symbols"] = expanded
        state["used_graph"] = True

        merged: dict[str, dict[str, Any]] = {item["id"]: item for item in state.get("context_pack", [])}
        for symbol in expanded:
            merged.setdefault(symbol["id"], symbol)
        ordered = list(merged.values())
        state["context_pack"] = ordered[: max(12, len(seed))]
        state["trace"] = trace
        return state

    def call_path_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("call_path_tool")
        state["used_path"] = True

        repo_id = state["repo_id"]
        session_id = state.get("session_id")
        user_message = state.get("user_message", "")
        from_symbol, to_symbol = self._extract_path_endpoints(user_message)
        selected = state.get("selected_symbol")

        path_result = self.call_path_tool.run(
            repo_id=repo_id,
            from_symbol=from_symbol,
            to_symbol=to_symbol,
            max_hops=int(state.get("max_hops", 10)),
            session_id=session_id,
            selected_from=selected if selected and not from_symbol else None,
            selected_to=None,
        )
        state["path_result"] = path_result
        state["citations"] = path_result.get("citations", [])
        state["disambiguation"] = path_result.get("disambiguation")
        if path_result.get("found"):
            state["context_pack"] = [
                {
                    "id": f"path-{idx}",
                    "qualified_name": step["symbol"],
                    "file_path": step["source"],
                    "start_line": int(step["lines"].split("-")[0]),
                    "end_line": int(step["lines"].split("-")[-1]),
                    "code_snippet": step["snippet"],
                    "type": "function",
                }
                for idx, step in enumerate(path_result["path"])
            ]
        trace["path"] = {"from": from_symbol, "to": to_symbol, "found": bool(path_result.get("found"))}
        state["trace"] = trace
        return state

    def answer_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("answer")
        context_pack = state.get("context_pack", [])
        disambiguation = state.get("disambiguation")

        if disambiguation and disambiguation.get("needs_user_choice"):
            candidates = disambiguation.get("candidates", [])
            rows = [f"- {c['qualified_name']} ({c['source']}:{c['lines']}) score={c['score']}" for c in candidates[:10]]
            state["answer"] = "检测到符号歧义，请从候选中选择：\n" + "\n".join(rows)
            state["citations"] = []
            trace["disambiguation"] = disambiguation
            state["trace"] = trace
            return state

        citations = state.get("citations", [])
        if not citations:
            citations = self._build_citations_from_context(context_pack)
            state["citations"] = citations

        trace_summary = (
            f"route={state.get('route')}, retrieval={state.get('used_retrieval', False)}, "
            f"graph={state.get('used_graph', False)}, path={state.get('used_path', False)}"
        )
        answer = self.runtime.answer_from_context(
            question=state.get("user_message", ""),
            context_pack=context_pack,
            citations=citations,
            trace_summary=trace_summary,
        )
        state["answer"] = answer
        state["trace"] = trace
        return state

    def verify_node(self, state: GraphState) -> GraphState:
        trace = state.get("trace", {})
        trace.setdefault("nodes", []).append("verify")

        attempts = int(state.get("attempts", 0))
        max_attempts = int(state.get("max_attempts", 2))
        citations = state.get("citations", [])
        context_pack = state.get("context_pack", [])
        disambiguation = state.get("disambiguation") or {}

        weak_evidence = (not citations or not context_pack) and not disambiguation.get("needs_user_choice", False)
        if weak_evidence and attempts + 1 < max_attempts:
            state["needs_retry"] = True
            state["attempts"] = attempts + 1
            state["top_k"] = int(state.get("top_k", 8)) + 2
            state["graph_depth"] = min(int(state.get("graph_depth", 2)) + 1, 3)
            state["rewritten_query"] = self.runtime.rewrite_query(state.get("user_message", ""), attempts)
            trace["retry"] = {"attempt": state["attempts"], "rewritten_query": state["rewritten_query"]}
        else:
            state["needs_retry"] = False
            state["attempts"] = attempts + 1
        trace["attempts"] = state["attempts"]
        state["trace"] = trace
        return state

    @staticmethod
    def _extract_symbol_hint(message: str) -> str:
        token = message.strip()
        match = re.search(r"[A-Za-z_][\w.]*", token)
        if match:
            return match.group(0)
        return token

    @staticmethod
    def _extract_path_endpoints(message: str) -> tuple[str, str]:
        msg = message.strip()
        en = re.search(r"from\s+([A-Za-z_][\w.]*)\s+to\s+([A-Za-z_][\w.]*)", msg, re.IGNORECASE)
        if en:
            return en.group(1), en.group(2)
        zh = re.search(r"从\s*([A-Za-z_][\w.]*)\s*到\s*([A-Za-z_][\w.]*)", msg)
        if zh:
            return zh.group(1), zh.group(2)
        parts = re.findall(r"[A-Za-z_][\w.]*", msg)
        if len(parts) >= 2:
            return parts[0], parts[1]
        if len(parts) == 1:
            return parts[0], parts[0]
        return "", ""

    @staticmethod
    def _build_citations_from_context(context_pack: list[dict[str, Any]]) -> list[dict[str, str]]:
        citations: list[dict[str, str]] = []
        for symbol in context_pack[:12]:
            lines = f"{symbol.get('start_line', 1)}-{symbol.get('end_line', 1)}"
            citations.append(
                {
                    "source": str(symbol.get("file_path", "")),
                    "lines": lines,
                    "symbol": str(symbol.get("qualified_name", symbol.get("name", ""))),
                    "quote": str(symbol.get("code_snippet", ""))[:300],
                }
            )
        return citations
