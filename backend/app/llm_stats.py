"""
In-memory counter for every Gemma-3n call the platform makes.

Used by the AI Models page on the UI.  The goal is transparency:
'did the model just get hit 50 times this minute?' and 'what did the
last few responses actually say?' should both be one click away.

We store a small ring buffer of the most recent N requests (prompts,
responses, latencies) plus per-endpoint aggregates.  Nothing is written
to disk — a backend restart wipes the counters.
"""
from __future__ import annotations

import collections
import threading
import time as _time
from datetime import datetime, timezone
from typing import Any

_LOCK = threading.Lock()
_RING_MAX = 80

_state: dict[str, Any] = {
    "started_at": datetime.now(timezone.utc).isoformat(),
    "requests_total":   0,
    "requests_success": 0,
    "requests_failure": 0,
    "tokens_prompt":    0,
    "tokens_completion":0,
    "latency_total_ms": 0,
    "decisions": {"BUY": 0, "SELL": 0, "HOLD": 0, "OTHER": 0},
    "by_endpoint": {},       # endpoint → {req, success, fail, tokens_p, tokens_c, latency_ms}
    "recent": collections.deque(maxlen=_RING_MAX),   # newest first
}


def _endpoint_bucket(endpoint: str) -> dict[str, int]:
    bucket = _state["by_endpoint"].setdefault(endpoint, {
        "requests": 0, "success": 0, "failure": 0,
        "tokens_prompt": 0, "tokens_completion": 0, "latency_ms": 0,
    })
    return bucket


def record(
    *,
    endpoint: str,
    ok: bool,
    status_code: int | None = None,
    latency_ms: int = 0,
    tokens_prompt: int = 0,
    tokens_completion: int = 0,
    model: str | None = None,
    decision: str | None = None,
    prompt_preview: str | None = None,
    response_preview: str | None = None,
    error: str | None = None,
) -> None:
    with _LOCK:
        _state["requests_total"] += 1
        bucket = _endpoint_bucket(endpoint)
        bucket["requests"] += 1
        bucket["latency_ms"] += int(latency_ms)
        _state["latency_total_ms"] += int(latency_ms)
        bucket["tokens_prompt"] += int(tokens_prompt)
        bucket["tokens_completion"] += int(tokens_completion)
        _state["tokens_prompt"] += int(tokens_prompt)
        _state["tokens_completion"] += int(tokens_completion)
        if ok:
            _state["requests_success"] += 1
            bucket["success"] += 1
        else:
            _state["requests_failure"] += 1
            bucket["failure"] += 1
        if decision:
            d = decision.upper()
            _state["decisions"][d if d in _state["decisions"] else "OTHER"] += 1

        _state["recent"].appendleft({
            "ts": datetime.now(timezone.utc).isoformat(),
            "endpoint": endpoint,
            "ok": bool(ok),
            "status_code": status_code,
            "latency_ms": int(latency_ms),
            "tokens_prompt": int(tokens_prompt),
            "tokens_completion": int(tokens_completion),
            "model": model,
            "decision": decision,
            "prompt_preview": (prompt_preview or "")[:320],
            "response_preview": (response_preview or "")[:320],
            "error": (error or "")[:160] or None,
        })


def snapshot() -> dict[str, Any]:
    with _LOCK:
        s = dict(_state)
        s["recent"] = list(_state["recent"])
        s["by_endpoint"] = {k: dict(v) for k, v in _state["by_endpoint"].items()}
        return s


class Timer:
    """Convenience context manager for endpoints that want to time the call."""
    __slots__ = ("_t0", "ms")
    def __enter__(self):
        self._t0 = _time.time()
        self.ms = 0
        return self
    def __exit__(self, exc_type, exc, tb):
        self.ms = int((_time.time() - self._t0) * 1000)
        return False
