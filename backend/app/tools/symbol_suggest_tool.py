from __future__ import annotations

from typing import Any

from app.search.suggest import SymbolSuggester


class SymbolSuggestTool:
    def __init__(self, suggester: SymbolSuggester) -> None:
        self.suggester = suggester

    def run(
        self,
        repo_id: str,
        query: str,
        session_id: str | None = None,
        top_n: int = 10,
        mode: str = "fuzzy",
    ) -> list[dict[str, Any]]:
        return self.suggester.suggest(repo_id=repo_id, query=query, session_id=session_id, top_n=top_n, mode=mode)

    def disambiguate(
        self,
        repo_id: str,
        query: str,
        session_id: str | None = None,
        top_n: int = 10,
    ) -> dict[str, Any]:
        return self.suggester.disambiguate(repo_id=repo_id, query=query, session_id=session_id, top_n=top_n)
