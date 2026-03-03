from __future__ import annotations

from typing import Any

from app.search.suggest import SymbolSuggester
from app.stores.kuzu_store import KuzuGraphStore


class CallPathTool:
    def __init__(self, kuzu_store: KuzuGraphStore, suggester: SymbolSuggester) -> None:
        self.kuzu_store = kuzu_store
        self.suggester = suggester

    def run(
        self,
        repo_id: str,
        from_symbol: str,
        to_symbol: str,
        max_hops: int,
        session_id: str | None = None,
        selected_from: str | None = None,
        selected_to: str | None = None,
    ) -> dict[str, Any]:
        from_resolution = self._resolve_symbol(repo_id, from_symbol, session_id, selected_from)
        to_resolution = self._resolve_symbol(repo_id, to_symbol, session_id, selected_to)

        if from_resolution.get("needs_user_choice") or to_resolution.get("needs_user_choice"):
            return {
                "found": False,
                "path": [],
                "citations": [],
                "explain": "符号存在歧义，需先选择候选。",
                "disambiguation": {
                    "needs_user_choice": True,
                    "from": from_resolution,
                    "to": to_resolution,
                },
            }

        from_qname = from_resolution.get("resolved")
        to_qname = to_resolution.get("resolved")
        if not from_qname or not to_qname:
            return {
                "found": False,
                "path": [],
                "citations": [],
                "explain": "未找到 from/to 对应符号。",
                "disambiguation": {
                    "needs_user_choice": False,
                    "from": from_resolution,
                    "to": to_resolution,
                },
            }

        path_nodes = self.kuzu_store.find_path(
            from_qname=from_qname,
            to_qname=to_qname,
            max_hops=max_hops,
            repo_id=repo_id,
        )
        if not path_nodes:
            return {
                "found": False,
                "path": [],
                "citations": [],
                "explain": f"在 max_hops={max_hops} 内未找到调用路径。",
                "disambiguation": {"needs_user_choice": False, "from": from_resolution, "to": to_resolution},
            }

        path = []
        citations = []
        for node in path_nodes:
            lines = f"{node['start_line']}-{node['end_line']}"
            step = {
                "symbol": node["qualified_name"],
                "source": node["file_path"],
                "lines": lines,
                "snippet": node.get("code_snippet", ""),
                "edge": node.get("edge"),
            }
            path.append(step)
            citations.append(
                {
                    "source": node["file_path"],
                    "lines": lines,
                    "symbol": node["qualified_name"],
                    "quote": (node.get("code_snippet") or "")[:300],
                }
            )
        return {
            "found": True,
            "path": path,
            "citations": citations,
            "explain": f"找到 {len(path)} 个节点的调用路径。",
            "disambiguation": {"needs_user_choice": False, "from": from_resolution, "to": to_resolution},
        }

    def _resolve_symbol(
        self,
        repo_id: str,
        query: str,
        session_id: str | None = None,
        selected: str | None = None,
    ) -> dict[str, Any]:
        if selected:
            return {"resolved": selected, "needs_user_choice": False, "candidates": []}
        query = (query or "").strip()
        if not query:
            return {"resolved": None, "needs_user_choice": False, "candidates": []}
        if "." in query:
            exact = self.kuzu_store.get_symbol_by_qname(repo_id=repo_id, qname=query)
            if exact is not None:
                return {"resolved": query, "needs_user_choice": False, "candidates": []}
        return self.suggester.disambiguate(repo_id=repo_id, query=query, session_id=session_id, top_n=10)
