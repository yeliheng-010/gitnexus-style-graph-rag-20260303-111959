from __future__ import annotations

from typing import Any

from rapidfuzz import fuzz

from app.session_store import SessionStore
from app.stores.kuzu_store import KuzuGraphStore


class SymbolSuggester:
    def __init__(self, kuzu_store: KuzuGraphStore, session_store: SessionStore) -> None:
        self.kuzu_store = kuzu_store
        self.session_store = session_store

    def suggest(
        self,
        repo_id: str,
        query: str,
        mode: str = "fuzzy",
        top_n: int = 10,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        query = (query or "").strip()
        if not query:
            return []
        symbols = self.kuzu_store.get_symbols(repo_id)
        if not symbols:
            return []

        boosts = self.session_store.get_boosts(session_id or "") if session_id else {}
        query_lower = query.lower()

        scored: list[tuple[float, dict[str, Any]]] = []
        for symbol in symbols:
            qname = str(symbol["qualified_name"])
            name = str(symbol["name"])
            qname_lower = qname.lower()
            name_lower = name.lower()

            prefix_bonus = 1.0 if qname_lower.startswith(query_lower) or name_lower.startswith(query_lower) else 0.0
            exact_bonus = 1.0 if query_lower in {qname_lower, name_lower} else 0.0

            fuzzy_score = self._fuzzy(query, qname, name)
            if mode == "prefix" and prefix_bonus <= 0 and exact_bonus <= 0:
                continue
            session_boost = boosts.get(qname, 0.0)
            final_score = (0.60 * fuzzy_score) + (0.25 * prefix_bonus) + (0.05 * exact_bonus) + (0.10 * session_boost)
            scored.append((final_score, symbol))

        scored.sort(
            key=lambda item: (
                item[0],
                str(item[1]["qualified_name"]).lower().startswith(query_lower),
                -int(item[1]["start_line"]),
            ),
            reverse=True,
        )

        out: list[dict[str, Any]] = []
        for score, symbol in scored[:top_n]:
            out.append(
                {
                    "qualified_name": symbol["qualified_name"],
                    "type": symbol["type"],
                    "source": symbol["file_path"],
                    "lines": f"{symbol['start_line']}-{symbol['end_line']}",
                    "score": round(float(score), 4),
                }
            )
        return out

    def disambiguate(
        self,
        repo_id: str,
        query: str,
        session_id: str | None = None,
        top_n: int = 10,
    ) -> dict[str, Any]:
        candidates = self.suggest(repo_id=repo_id, query=query, mode="fuzzy", top_n=top_n, session_id=session_id)
        if not candidates:
            return {"resolved": None, "needs_user_choice": False, "candidates": []}
        if len(candidates) == 1:
            return {"resolved": candidates[0]["qualified_name"], "needs_user_choice": False, "candidates": candidates}

        top1 = float(candidates[0]["score"])
        top2 = float(candidates[1]["score"])
        if top1 >= 0.90 and (top1 - top2) >= 0.08:
            return {"resolved": candidates[0]["qualified_name"], "needs_user_choice": False, "candidates": candidates}
        return {"resolved": None, "needs_user_choice": True, "candidates": candidates}

    @staticmethod
    def _fuzzy(query: str, qname: str, name: str) -> float:
        query = query.strip()
        if not query:
            return 0.0
        p1 = fuzz.partial_ratio(query, qname) / 100.0
        p2 = fuzz.token_sort_ratio(query, qname) / 100.0
        p3 = fuzz.partial_ratio(query, name) / 100.0
        return max(p1, p2, p3)
