from __future__ import annotations

from typing import Any, Literal, TypedDict


class GraphState(TypedDict, total=False):
    messages: list[dict[str, str]]
    history: list[dict[str, str]]
    user_message: str
    repo_id: str
    session_id: str
    selected_symbol: str | None

    top_k: int
    graph_depth: int
    hybrid: bool
    max_hops: int

    plan: str
    route: Literal["direct_answer", "RAG", "GraphRAG", "CallPath", "NeedDisambiguation"]
    retrieval_mode: Literal["none", "semantic", "hybrid"]

    retrieved_symbols: list[dict[str, Any]]
    expanded_symbols: list[dict[str, Any]]
    path_result: dict[str, Any] | None
    context_pack: list[dict[str, Any]]

    used_retrieval: bool
    used_graph: bool
    used_path: bool

    citations: list[dict[str, str]]
    symbol_candidates: list[dict[str, Any]]
    disambiguation: dict[str, Any] | None

    attempts: int
    max_attempts: int
    needs_retry: bool
    rewritten_query: str | None

    answer: str
    trace: dict[str, Any]
