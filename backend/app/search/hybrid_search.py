from __future__ import annotations

from typing import Any

from app.stores.bm25_store import BM25Store
from app.stores.chroma_store import ChromaSymbolStore


class HybridSearcher:
    def __init__(self, chroma_store: ChromaSymbolStore, bm25_store: BM25Store, rrf_k: int = 60) -> None:
        self.chroma_store = chroma_store
        self.bm25_store = bm25_store
        self.rrf_k = rrf_k

    def search(self, repo_id: str, query: str, top_k: int, hybrid: bool) -> list[dict[str, Any]]:
        semantic_hits = self.chroma_store.semantic_search(repo_id=repo_id, query=query, top_k=top_k)
        if not hybrid:
            out = []
            for item in semantic_hits:
                out.append(
                    {
                        "id": item["id"],
                        "score": item["score"],
                        "rrf_score": item["score"],
                        "semantic_rank": item["rank"],
                        "keyword_rank": None,
                        "metadata": item["metadata"],
                        "text": item["text"],
                    }
                )
            return out[:top_k]

        keyword_hits = self.bm25_store.search(repo_id=repo_id, query=query, top_k=top_k)
        fusion: dict[str, dict[str, Any]] = {}

        for hit in semantic_hits:
            sid = hit["id"]
            entry = fusion.setdefault(
                sid,
                {
                    "id": sid,
                    "metadata": hit["metadata"],
                    "text": hit["text"],
                    "semantic_rank": None,
                    "keyword_rank": None,
                    "semantic_score": 0.0,
                    "keyword_score": 0.0,
                    "rrf_score": 0.0,
                },
            )
            entry["semantic_rank"] = hit["rank"]
            entry["semantic_score"] = hit["score"]
            entry["rrf_score"] += 1.0 / (self.rrf_k + hit["rank"])

        for hit in keyword_hits:
            sid = hit["id"]
            entry = fusion.setdefault(
                sid,
                {
                    "id": sid,
                    "metadata": hit["metadata"],
                    "text": hit["text"],
                    "semantic_rank": None,
                    "keyword_rank": None,
                    "semantic_score": 0.0,
                    "keyword_score": 0.0,
                    "rrf_score": 0.0,
                },
            )
            entry["keyword_rank"] = hit["rank"]
            entry["keyword_score"] = hit["score"]
            entry["rrf_score"] += 1.0 / (self.rrf_k + hit["rank"])

        ranked = sorted(fusion.values(), key=lambda x: x["rrf_score"], reverse=True)[:top_k]
        for item in ranked:
            item["score"] = item["rrf_score"]
        return ranked
