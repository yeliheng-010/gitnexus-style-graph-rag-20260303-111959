from __future__ import annotations

from app.main import ctx


def test_prefix_and_fuzzy_suggest_and_ranking(client, ingested_repo) -> None:
    repo_id = ingested_repo["repo_id"]

    resp_prefix = client.get(
        "/symbols/suggest",
        params={"repo_id": repo_id, "q": "app.entry.r", "mode": "prefix", "top_n": 10},
    )
    assert resp_prefix.status_code == 200, resp_prefix.text
    prefix_candidates = resp_prefix.json()["candidates"]
    assert prefix_candidates, "prefix suggest should return candidates"
    assert prefix_candidates[0]["qualified_name"] == "app.entry.run_app"

    resp_fuzzy = client.get(
        "/symbols/suggest",
        params={"repo_id": repo_id, "q": "saveor", "mode": "fuzzy", "top_n": 10},
    )
    assert resp_fuzzy.status_code == 200, resp_fuzzy.text
    fuzzy_candidates = resp_fuzzy.json()["candidates"]
    assert fuzzy_candidates, "fuzzy suggest should return candidates"
    assert any(item["qualified_name"] == "app.repo.save_order" for item in fuzzy_candidates)

    session_id = "sess_boost_order"
    ctx.session_store.add_recent_symbols(session_id, ["app.entry.run_app"] * 5)
    boosted = client.get(
        "/symbols/suggest",
        params={"repo_id": repo_id, "q": "run", "mode": "fuzzy", "top_n": 10, "session_id": session_id},
    )
    assert boosted.status_code == 200, boosted.text
    boosted_candidates = boosted.json()["candidates"]
    assert boosted_candidates
    assert boosted_candidates[0]["qualified_name"] == "app.entry.run_app"
