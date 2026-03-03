from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "GitNexus Style GraphRAG"
    storage_root: str = "/app/storage"
    mounted_repo_root: str = "/repo"

    # DashScope OpenAI-compatible defaults (Qwen).
    dashscope_api_key: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_chat_model: str = "qwen3.5-plus"
    llm_embedding_model: str = "text-embedding-v3"

    # Backward compatibility with previous OPENAI_* env variables.
    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    default_top_k: int = 8
    default_graph_depth: int = 2
    default_hybrid: bool = True
    default_suggest_top_n: int = 10
    max_verify_attempts: int = 2
    rrf_k: int = 60

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_root)

    @property
    def effective_api_key(self) -> str | None:
        raw = self.llm_api_key or self.dashscope_api_key or self.openai_api_key
        if not raw:
            return None
        value = raw.strip()
        if not value:
            return None
        upper = value.upper()
        placeholder_tokens = (
            "YOUR_DASHSCOPE_API_KEY_HERE",
            "YOUR_OPENAI_API_KEY_HERE",
            "PLACEHOLDER",
            "YOUR_API_KEY",
        )
        if upper in placeholder_tokens or upper.startswith("YOUR_"):
            return None
        return value

    @property
    def effective_chat_model(self) -> str:
        return self.llm_chat_model or self.openai_chat_model

    @property
    def effective_embedding_model(self) -> str:
        return self.llm_embedding_model or self.openai_embedding_model

    @property
    def kuzu_root(self) -> Path:
        return self.storage_path / "kuzu"

    @property
    def chroma_root(self) -> Path:
        return self.storage_path / "chroma"

    @property
    def bm25_root(self) -> Path:
        return self.storage_path / "bm25"

    @property
    def ingest_root(self) -> Path:
        return self.storage_path / "ingest"

    @property
    def registry_file(self) -> Path:
        return self.storage_path / "repo_registry.json"

    @property
    def session_file(self) -> Path:
        return self.storage_path / "session_store.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    settings.kuzu_root.mkdir(parents=True, exist_ok=True)
    settings.chroma_root.mkdir(parents=True, exist_ok=True)
    settings.bm25_root.mkdir(parents=True, exist_ok=True)
    settings.ingest_root.mkdir(parents=True, exist_ok=True)
    return settings
