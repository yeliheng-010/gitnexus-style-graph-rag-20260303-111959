from __future__ import annotations

import hashlib
import json
from pathlib import Path
from threading import Lock


class RepoRegistry:
    def __init__(self, registry_file: Path) -> None:
        self.registry_file = registry_file
        self._lock = Lock()
        self._data = self._load()

    def _load(self) -> dict[str, dict[str, str]]:
        if not self.registry_file.exists():
            return {}
        return json.loads(self.registry_file.read_text(encoding="utf-8"))

    def _persist(self) -> None:
        self.registry_file.parent.mkdir(parents=True, exist_ok=True)
        self.registry_file.write_text(json.dumps(self._data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_or_create_repo_id(self, repo_path: str) -> str:
        normalized = str(Path(repo_path).as_posix())
        digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]
        repo_id = f"repo_{digest}"
        with self._lock:
            self._data[repo_id] = {"repo_path": normalized}
            self._persist()
        return repo_id

    def get_repo_path(self, repo_id: str) -> str | None:
        entry = self._data.get(repo_id)
        if not entry:
            self._data = self._load()
            entry = self._data.get(repo_id)
        if not entry:
            return None
        return entry.get("repo_path")
