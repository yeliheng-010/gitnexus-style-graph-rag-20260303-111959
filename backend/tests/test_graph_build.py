from __future__ import annotations

from pathlib import Path

from app.ingest.symbol_graph_builder import SymbolGraphBuilder
from app.stores.kuzu_store import KuzuGraphStore


def test_graph_build_and_path(sample_repo_path: str) -> None:
    repo_path = Path(sample_repo_path)
    repo_id = "repo_test_graph_build"
    builder = SymbolGraphBuilder()
    symbols, edges = builder.build(
        repo_id=repo_id,
        repo_root=repo_path,
        include_globs=["**/*.*"],
        exclude_globs=["**/__pycache__/**"],
        languages=["python", "typescript", "javascript"],
    )
    assert len(symbols) > 0
    assert any(edge.type == "CALLS" for edge in edges)

    store = KuzuGraphStore(Path("/app/storage/kuzu/repo_test_graph_build/graph.kuzu"))
    store.clear_repo(repo_id)
    store.upsert_graph(symbols, edges)

    path = store.find_path(
        from_qname="app.entry.run_app",
        to_qname="app.repo.save_order",
        max_hops=10,
        repo_id=repo_id,
    )
    assert path, "Expected a callable path from run_app to save_order"
    assert path[0]["qualified_name"] == "app.entry.run_app"
    assert path[-1]["qualified_name"] == "app.repo.save_order"
