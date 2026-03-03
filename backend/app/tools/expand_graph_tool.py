from __future__ import annotations

from typing import Any

from app.stores.kuzu_store import KuzuGraphStore


class ExpandGraphTool:
    def __init__(self, kuzu_store: KuzuGraphStore) -> None:
        self.kuzu_store = kuzu_store

    def run(self, repo_id: str, seed_symbols: list[dict[str, Any]], depth: int) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for symbol in seed_symbols:
            node_id = symbol["id"]
            neighbors = self.kuzu_store.neighbors(
                node_id=node_id,
                edge_types=["CALLS", "IMPORTS", "OWNS", "HERITAGE"],
                direction="out",
                depth=depth,
                repo_id=repo_id,
            )
            inbound = self.kuzu_store.neighbors(
                node_id=node_id,
                edge_types=["CALLS"],
                direction="in",
                depth=depth,
                repo_id=repo_id,
            )
            for item in neighbors + inbound:
                out[item["id"]] = item
        return list(out.values())
