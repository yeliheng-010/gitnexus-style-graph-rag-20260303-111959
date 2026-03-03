from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi

from app.ingest.tree_sitter_parser import SymbolDraft


@dataclass
class BM25Index:
    bm25: BM25Okapi
    docs: list[dict[str, Any]]
    tokenized: list[list[str]]


class BM25Store:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, BM25Index] = {}

    def reset_repo(self, repo_id: str) -> Path:
        repo_dir = self.root / repo_id
        repo_dir.mkdir(parents=True, exist_ok=True)
        file_path = repo_dir / "index.json"
        if file_path.exists():
            file_path.unlink()
        self._cache.pop(repo_id, None)
        return repo_dir

    def index_symbols(self, repo_id: str, symbols: list[SymbolDraft], text_map: dict[str, str]) -> None:
        docs: list[dict[str, Any]] = []
        tokenized: list[list[str]] = []
        for symbol in symbols:
            text = text_map.get(symbol.id, symbol.qualified_name)
            tokens = self._tokenize(text)
            docs.append(
                {
                    "id": symbol.id,
                    "qualified_name": symbol.qualified_name,
                    "name": symbol.name,
                    "type": symbol.type,
                    "file_path": symbol.file_path,
                    "start_line": symbol.start_line,
                    "end_line": symbol.end_line,
                    "signature": symbol.signature,
                    "docstring": symbol.docstring,
                    "code_snippet": symbol.code_snippet,
                    "text": text,
                }
            )
            tokenized.append(tokens)

        if not tokenized:
            self._cache[repo_id] = BM25Index(bm25=BM25Okapi([["empty"]]), docs=[], tokenized=[])
            return

        bm25 = BM25Okapi(tokenized)
        self._cache[repo_id] = BM25Index(bm25=bm25, docs=docs, tokenized=tokenized)
        self._persist(repo_id, docs, tokenized)

    def search(self, repo_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
        index = self._cache.get(repo_id) or self._load(repo_id)
        if index is None or not index.docs:
            return []
        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []
        scores = index.bm25.get_scores(q_tokens)
        ranked_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        out: list[dict[str, Any]] = []
        for rank, i in enumerate(ranked_idx, start=1):
            doc = index.docs[i]
            score = float(scores[i])
            if score <= 0:
                continue
            out.append({"id": doc["id"], "score": score, "rank": rank, "metadata": doc, "text": doc["text"]})
        return out

    def _persist(self, repo_id: str, docs: list[dict[str, Any]], tokenized: list[list[str]]) -> None:
        repo_dir = self.root / repo_id
        repo_dir.mkdir(parents=True, exist_ok=True)
        path = repo_dir / "index.json"
        path.write_text(json.dumps({"docs": docs, "tokenized": tokenized}, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load(self, repo_id: str) -> BM25Index | None:
        path = self.root / repo_id / "index.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        docs = payload.get("docs", [])
        tokenized = payload.get("tokenized", [])
        if not tokenized:
            return None
        index = BM25Index(bm25=BM25Okapi(tokenized), docs=docs, tokenized=tokenized)
        self._cache[repo_id] = index
        return index

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        if not text:
            return []
        return re.findall(r"[A-Za-z_]\w+|\d+", text.lower())
