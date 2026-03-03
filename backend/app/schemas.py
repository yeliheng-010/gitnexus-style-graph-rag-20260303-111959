from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str
    lines: str
    symbol: str
    quote: str


class IngestRequest(BaseModel):
    repo_path: str
    include_globs: list[str] = Field(default_factory=lambda: ["**/*.*"])
    exclude_globs: list[str] = Field(
        default_factory=lambda: ["**/.git/**", "**/node_modules/**", "**/venv/**", "**/__pycache__/**"]
    )
    languages: list[Literal["python", "typescript", "javascript"]] = Field(
        default_factory=lambda: ["python", "typescript", "javascript"]
    )


class IngestResponse(BaseModel):
    repo_id: str
    symbols: int
    edges: int
    kuzu_path: str
    chroma_path: str


class SymbolCandidate(BaseModel):
    qualified_name: str
    type: str
    source: str
    lines: str
    score: float


class SuggestResponse(BaseModel):
    query: str
    mode: str
    candidates: list[SymbolCandidate]


class ChatRequest(BaseModel):
    session_id: str
    repo_id: str
    message: str
    top_k: int = 8
    graph_depth: int = 2
    hybrid: bool = True
    selected_symbol: str | None = None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    used_retrieval: bool
    used_graph: bool
    used_path: bool
    trace: dict[str, Any]
    disambiguation: dict[str, Any] | None = None


class PathRequest(BaseModel):
    repo_id: str
    from_symbol: str
    to_symbol: str
    max_hops: int = 10
    session_id: str | None = None


class PathStep(BaseModel):
    symbol: str
    source: str
    lines: str
    snippet: str
    edge: str | None = None


class PathResponse(BaseModel):
    found: bool
    path: list[PathStep]
    citations: list[Citation]
    explain: str
    trace: dict[str, Any] | None = None
