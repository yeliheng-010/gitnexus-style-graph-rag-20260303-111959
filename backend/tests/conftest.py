from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def sample_repo_path() -> str:
    candidates = [Path("/app/sample_repo"), Path("/repo/sample_repo"), Path(__file__).resolve().parents[2] / "sample_repo"]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    raise RuntimeError("sample_repo path not found")


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def ingest_payload(sample_repo_path: str) -> dict[str, object]:
    return {
        "repo_path": sample_repo_path,
        "include_globs": ["**/*.*"],
        "exclude_globs": ["**/.git/**", "**/node_modules/**", "**/venv/**", "**/__pycache__/**"],
        "languages": ["python", "typescript", "javascript"],
    }


@pytest.fixture(scope="session")
def ingested_repo(client: TestClient, ingest_payload: dict[str, object]) -> dict[str, object]:
    resp = client.post("/ingest", json=ingest_payload)
    assert resp.status_code == 200, resp.text
    return resp.json()
