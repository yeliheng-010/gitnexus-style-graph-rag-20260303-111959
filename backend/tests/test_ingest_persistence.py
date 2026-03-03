from __future__ import annotations

from pathlib import Path


def test_ingest_persistence_dirs_exist_and_nonempty(ingested_repo) -> None:
    repo_id = ingested_repo["repo_id"]
    assert ingested_repo["symbols"] > 0
    assert ingested_repo["edges"] > 0

    kuzu_path = Path(ingested_repo["kuzu_path"])
    chroma_path = Path(ingested_repo["chroma_path"])
    bm25_path = Path(f"/app/storage/bm25/{repo_id}/index.json")

    assert kuzu_path.exists(), f"kuzu db path missing: {kuzu_path}"
    assert chroma_path.exists(), f"chroma path missing: {chroma_path}"
    assert bm25_path.exists(), f"bm25 index missing: {bm25_path}"

    chroma_files = list(chroma_path.rglob("*"))
    assert any(p.is_file() for p in chroma_files), "chroma persist directory should contain files"
