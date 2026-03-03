from __future__ import annotations


def test_chat_and_path_api_shapes(client, ingested_repo) -> None:
    repo_id = ingested_repo["repo_id"]
    chat_resp = client.post(
        "/chat",
        json={
            "session_id": "sess_api_chat",
            "repo_id": repo_id,
            "message": "how does app.entry.run_app eventually call app.repo.save_order?",
            "top_k": 8,
            "graph_depth": 2,
            "hybrid": True,
        },
    )
    assert chat_resp.status_code == 200, chat_resp.text
    chat_data = chat_resp.json()
    for key in ["answer", "citations", "used_retrieval", "used_graph", "used_path", "trace"]:
        assert key in chat_data
    assert isinstance(chat_data["trace"], dict)

    path_resp = client.post(
        "/path",
        json={
            "repo_id": repo_id,
            "from_symbol": "app.entry.run_app",
            "to_symbol": "app.repo.save_order",
            "max_hops": 10,
            "session_id": "sess_api_chat",
        },
    )
    assert path_resp.status_code == 200, path_resp.text
    path_data = path_resp.json()
    assert path_data["found"] is True
    assert len(path_data["path"]) >= 2
    assert len(path_data["citations"]) >= 1
    assert "trace" in path_data
