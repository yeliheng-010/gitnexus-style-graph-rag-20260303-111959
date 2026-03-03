from __future__ import annotations

from typing import Any

from app.search.hybrid_search import HybridSearcher
from app.stores.kuzu_store import KuzuGraphStore


class RetrieveTool:
    def __init__(self, searcher: HybridSearcher, kuzu_store: KuzuGraphStore) -> None:
        self.searcher = searcher
        self.kuzu_store = kuzu_store

    def run(self, repo_id: str, query: str, top_k: int, hybrid: bool) -> list[dict[str, Any]]:
        hits = self.searcher.search(repo_id=repo_id, query=query, top_k=top_k, hybrid=hybrid)
        symbols = self.kuzu_store.get_symbols(repo_id)
        symbol_map = {s["id"]: s for s in symbols}
        out: list[dict[str, Any]] = []
        for hit in hits:
            sid = hit["id"]
            symbol = symbol_map.get(sid)
            if not symbol:
                continue
            out.append(
                {
                    **symbol,
                    "score": hit.get("score", 0.0),
                    "semantic_rank": hit.get("semantic_rank"),
                    "keyword_rank": hit.get("keyword_rank"),
                }
            )
        return out
