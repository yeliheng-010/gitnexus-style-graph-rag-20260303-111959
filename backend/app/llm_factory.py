from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from typing import Iterable

from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.config import Settings

ROUTE_OPTIONS = {"direct_answer", "RAG", "GraphRAG", "CallPath", "NeedDisambiguation"}


def _is_test_runtime() -> bool:
    argv0 = (sys.argv[0] if sys.argv else "").lower()
    if "pytest" in argv0:
        return True
    if "PYTEST_CURRENT_TEST" in os.environ:
        return True
    return any(name.startswith("_pytest") for name in sys.modules)


def _should_use_dummy_embeddings(settings: Settings) -> bool:
    base = (settings.llm_base_url or "").lower()
    # DashScope's embedding endpoint is not fully compatible with langchain_openai's
    # request shape in all versions. Keep ingest stable by using deterministic local embeddings.
    return "dashscope.aliyuncs.com" in base


class DummyEmbeddings(Embeddings):
    """Deterministic embeddings for offline/tests when API key is absent."""

    def __init__(self, dim: int = 128) -> None:
        self.dim = dim

    def _vector(self, text: str) -> list[float]:
        text = text or ""
        parts: list[float] = []
        for i in range(self.dim):
            digest = hashlib.sha1(f"{text}|{i}".encode("utf-8")).digest()
            value = int.from_bytes(digest[:4], "big") / 2**32
            parts.append((value * 2.0) - 1.0)
        norm = math.sqrt(sum(v * v for v in parts)) or 1.0
        return [v / norm for v in parts]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


class FakeChatModel:
    """Tiny fake model to keep service available without OpenAI key."""

    def invoke(self, messages: Iterable[object], **_: object) -> AIMessage:
        chunks: list[str] = []
        for msg in messages:
            content = getattr(msg, "content", None)
            if content is None:
                content = str(msg)
            chunks.append(str(content))
        prompt = "\n".join(chunks)
        return AIMessage(content=prompt[:600])


@dataclass
class LLMRuntime:
    chat_model: ChatOpenAI | FakeChatModel
    embeddings: Embeddings
    is_fake: bool
    settings: Settings

    def decide_route(self, user_message: str) -> str:
        message_lower = user_message.lower()
        if any(k in message_lower for k in ("call path", "调用路径", "调用链", "from ", "to ")):
            return "CallPath"
        if re.search(r"\b[a-zA-Z_][\w]*(\.[\w]+)+\b", user_message):
            return "GraphRAG"
        if any(k in message_lower for k in ("where", "how", "why", "实现", "调用", "依赖")):
            return "GraphRAG"
        if len(user_message.split()) <= 2:
            return "NeedDisambiguation"

        if self.is_fake:
            return "RAG"

        prompt = [
            SystemMessage(
                content=(
                    "You are a route classifier for code QA. Output JSON only: "
                    '{"route":"direct_answer|RAG|GraphRAG|CallPath|NeedDisambiguation"}'
                )
            ),
            HumanMessage(content=user_message),
        ]
        try:
            response = self.chat_model.invoke(prompt)  # type: ignore[arg-type]
            content = getattr(response, "content", "")
            data = json.loads(content if isinstance(content, str) else str(content))
            route = str(data.get("route", "RAG"))
            if route in ROUTE_OPTIONS:
                return route
        except Exception:
            pass
        return "RAG"

    def rewrite_query(self, user_message: str, attempt: int) -> str:
        if self.is_fake:
            return f"{user_message} implementation details attempt {attempt + 1}"
        prompt = [
            SystemMessage(content="Rewrite this code-retrieval query with clearer symbol hints. Return only text."),
            HumanMessage(content=user_message),
        ]
        try:
            result = self.chat_model.invoke(prompt)  # type: ignore[arg-type]
            content = getattr(result, "content", "")
            rewritten = content if isinstance(content, str) else str(content)
            return rewritten.strip() or user_message
        except Exception:
            return user_message

    def answer_from_context(
        self,
        question: str,
        context_pack: list[dict[str, str]],
        citations: list[dict[str, str]],
        trace_summary: str,
    ) -> str:
        if not context_pack:
            return "不确定/缺少资料：当前检索上下文为空，无法基于证据给出可靠答案。"

        if self.is_fake:
            top = context_pack[:3]
            lines = [f"- {item['qualified_name']} ({item['file_path']}:{item['start_line']}-{item['end_line']})" for item in top]
            return (
                "基于检索到的代码片段，下面是可验证结论（FakeLLM模式）：\n"
                + "\n".join(lines)
                + f"\n问题：{question}\n"
                + "如需更精确解释，请提供 DASHSCOPE_API_KEY（或兼容 API Key）。"
            )

        snippet_text = "\n\n".join(
            [
                (
                    f"[{idx + 1}] {item['qualified_name']} @ {item['file_path']}:{item['start_line']}-{item['end_line']}\n"
                    f"{item['code_snippet']}"
                )
                for idx, item in enumerate(context_pack[:8])
            ]
        )
        citation_hint = "\n".join(
            [f"- {c['symbol']} -> {c['source']}:{c['lines']}" for c in citations[:12]]
        ) or "- none"

        prompt = [
            SystemMessage(
                content=(
                    "You answer repository questions only from provided context. "
                    "If evidence is weak, explicitly say '不确定/缺少资料'. "
                    "Return plain text Chinese, concise, and mention key symbols."
                )
            ),
            HumanMessage(
                content=(
                    f"Question:\n{question}\n\n"
                    f"Trace summary:\n{trace_summary}\n\n"
                    f"Context snippets:\n{snippet_text}\n\n"
                    f"Citation candidates:\n{citation_hint}"
                )
            ),
        ]
        try:
            result = self.chat_model.invoke(prompt)  # type: ignore[arg-type]
            content = getattr(result, "content", "")
            answer = content if isinstance(content, str) else str(content)
            return answer.strip() or "不确定/缺少资料：模型未返回有效回答。"
        except Exception as exc:
            return f"不确定/缺少资料：生成回答失败（{exc}）。"


def _build_chat_model(settings: Settings, api_key: str) -> ChatOpenAI:
    kwargs = {
        "api_key": api_key,
        "model": settings.effective_chat_model,
        "temperature": 0.1,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    try:
        return ChatOpenAI(**kwargs)
    except TypeError:
        # Older versions may use openai_api_base.
        if "base_url" in kwargs:
            kwargs["openai_api_base"] = kwargs.pop("base_url")
        return ChatOpenAI(**kwargs)


def _build_embeddings(settings: Settings, api_key: str) -> Embeddings:
    kwargs = {
        "api_key": api_key,
        "model": settings.effective_embedding_model,
        # DashScope/OpenAI-compatible endpoint expects string inputs.
        # Disable token-array payload mode used by some OpenAI embedding wrappers.
        "check_embedding_ctx_length": False,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    try:
        return OpenAIEmbeddings(**kwargs)
    except TypeError:
        if "base_url" in kwargs:
            kwargs["openai_api_base"] = kwargs.pop("base_url")
        return OpenAIEmbeddings(**kwargs)


def build_runtime(settings: Settings) -> LLMRuntime:
    # Keep tests fully offline and deterministic even if .env has a real key.
    if _is_test_runtime():
        return LLMRuntime(chat_model=FakeChatModel(), embeddings=DummyEmbeddings(), is_fake=True, settings=settings)

    api_key = settings.effective_api_key
    if api_key:
        chat_model = _build_chat_model(settings, api_key=api_key)
        if _should_use_dummy_embeddings(settings):
            embeddings = DummyEmbeddings()
        else:
            try:
                embeddings = _build_embeddings(settings, api_key=api_key)
            except Exception:
                embeddings = DummyEmbeddings()
        return LLMRuntime(chat_model=chat_model, embeddings=embeddings, is_fake=False, settings=settings)

    return LLMRuntime(chat_model=FakeChatModel(), embeddings=DummyEmbeddings(), is_fake=True, settings=settings)
