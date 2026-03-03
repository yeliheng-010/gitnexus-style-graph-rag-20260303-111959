from __future__ import annotations

import json
from collections import Counter, defaultdict, deque
from pathlib import Path
from threading import Lock


class SessionStore:
    def __init__(self, storage_file: Path, max_recent: int = 100) -> None:
        self.storage_file = storage_file
        self.max_recent = max_recent
        self._lock = Lock()
        self._recent_symbols: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=self.max_recent))
        self._history: dict[str, list[dict[str, str]]] = defaultdict(list)
        self._load()

    def _load(self) -> None:
        if not self.storage_file.exists():
            return
        data = json.loads(self.storage_file.read_text(encoding="utf-8"))
        for session_id, items in data.get("recent_symbols", {}).items():
            self._recent_symbols[session_id].extend(items)
        for session_id, items in data.get("history", {}).items():
            self._history[session_id] = list(items)

    def _persist(self) -> None:
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "recent_symbols": {k: list(v) for k, v in self._recent_symbols.items()},
            "history": self._history,
        }
        self.storage_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def add_recent_symbols(self, session_id: str, symbols: list[str]) -> None:
        with self._lock:
            self._recent_symbols[session_id].extend(symbols)
            self._persist()

    def get_boosts(self, session_id: str) -> dict[str, float]:
        with self._lock:
            counts = Counter(self._recent_symbols[session_id])
        if not counts:
            return {}
        max_count = max(counts.values())
        return {k: v / max_count for k, v in counts.items()}

    def append_message(self, session_id: str, role: str, content: str) -> None:
        with self._lock:
            self._history[session_id].append({"role": role, "content": content})
            self._history[session_id] = self._history[session_id][-30:]
            self._persist()

    def get_history(self, session_id: str) -> list[dict[str, str]]:
        with self._lock:
            return list(self._history.get(session_id, []))
