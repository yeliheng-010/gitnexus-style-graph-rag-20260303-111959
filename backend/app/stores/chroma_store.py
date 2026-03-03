from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.ingest.tree_sitter_parser import SymbolDraft


class ChromaSymbolStore:
    def __init__(self, chroma_root: Path, embeddings: Embeddings) -> None:
        self.chroma_root = chroma_root
        self.embeddings = embeddings
        self.chroma_root.mkdir(parents=True, exist_ok=True)

    def reset_repo(self, repo_id: str) -> Path:
        repo_dir = self.chroma_root / repo_id
        if repo_dir.exists():
            shutil.rmtree(repo_dir)
        repo_dir.mkdir(parents=True, exist_ok=True)
        return repo_dir

    def _store(self, repo_id: str) -> Chroma:
        return Chroma(
            collection_name=f"symbols_{repo_id}",
            embedding_function=self.embeddings,
            persist_directory=str(self.chroma_root / repo_id),
        )

    def index_symbols(self, repo_id: str, symbols: list[SymbolDraft], text_map: dict[str, str]) -> None:
        documents: list[Document] = []
        ids: list[str] = []
        for symbol in symbols:
            payload = text_map.get(symbol.id, symbol.code_snippet or symbol.qualified_name)
            metadata: dict[str, Any] = {
                "id": symbol.id,
                "repo_id": symbol.repo_id,
                "type": symbol.type,
                "name": symbol.name,
                "qualified_name": symbol.qualified_name,
                "file_path": symbol.file_path,
                "start_line": symbol.start_line,
                "end_line": symbol.end_line,
                "signature": symbol.signature,
                "docstring": symbol.docstring,
                "code_snippet": symbol.code_snippet,
            }
            documents.append(Document(page_content=payload, metadata=metadata))
            ids.append(symbol.id)

        store = self._store(repo_id)
        if documents:
            store.add_documents(documents=documents, ids=ids)

    def semantic_search(self, repo_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
        store = self._store(repo_id)
        hits = store.similarity_search_with_relevance_scores(query, k=top_k)
        results: list[dict[str, Any]] = []
        for rank, (doc, score) in enumerate(hits, start=1):
            metadata = dict(doc.metadata)
            results.append(
                {
                    "id": metadata.get("id"),
                    "score": float(score),
                    "rank": rank,
                    "metadata": metadata,
                    "text": doc.page_content,
                }
            )
        return results
