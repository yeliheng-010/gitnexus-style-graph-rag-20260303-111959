from __future__ import annotations

import re

from app.llm_factory import LLMRuntime


def route_message(runtime: LLMRuntime, message: str) -> str:
    msg = (message or "").strip()
    if not msg:
        return "direct_answer"

    lower = msg.lower()
    if any(k in lower for k in ["call path", "调用链", "调用路径", "入口到", "from", "to"]):
        return "CallPath"
    if re.search(r"\b(from|to)\s+[A-Za-z_][\w.]*", msg, flags=re.IGNORECASE):
        return "CallPath"
    if len(msg.split()) <= 2 and "." not in msg:
        return "NeedDisambiguation"
    return runtime.decide_route(msg)
