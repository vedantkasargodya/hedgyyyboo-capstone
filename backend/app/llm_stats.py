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

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, Boolean, desc

from app.trade_ledger import Base, SessionLocal, engine


# ---------------------------------------------------------------------------
# Persistent log table — survives backend restarts, used by the AI Models page
# ---------------------------------------------------------------------------

class LLMCallLog(Base):
    __tablename__ = "llm_call_log"

    call_id          = Column(Integer, primary_key=True, autoincrement=True)
    ts               = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    endpoint         = Column(String(80), nullable=False)
    model            = Column(String(80), nullable=True)
    ok               = Column(Boolean, nullable=False, default=False)
    status_code      = Column(Integer, nullable=True)
    latency_ms       = Column(Integer, nullable=True, default=0)
    tokens_prompt    = Column(Integer, nullable=True, default=0)
    tokens_completion= Column(Integer, nullable=True, default=0)
    decision         = Column(String(10), nullable=True)
    prompt_preview   = Column(Text, nullable=True)
    response_preview = Column(Text, nullable=True)
    error            = Column(Text, nullable=True)


def init_log_table() -> None:
    Base.metadata.create_all(engine, tables=[LLMCallLog.__table__])

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

    # Persist to DB outside the lock to avoid holding it across I/O.
    try:
        with SessionLocal() as s:
            s.add(LLMCallLog(
                endpoint=endpoint[:80],
                model=(model or "")[:80] or None,
                ok=bool(ok),
                status_code=status_code,
                latency_ms=int(latency_ms),
                tokens_prompt=int(tokens_prompt),
                tokens_completion=int(tokens_completion),
                decision=decision,
                prompt_preview=(prompt_preview or "")[:800] or None,
                response_preview=(response_preview or "")[:800] or None,
                error=(error or "")[:400] or None,
            ))
            s.commit()
    except Exception:
        # Never let log persistence break the calling code path.
        pass


def snapshot() -> dict[str, Any]:
    with _LOCK:
        s = dict(_state)
        s["recent"] = list(_state["recent"])
        s["by_endpoint"] = {k: dict(v) for k, v in _state["by_endpoint"].items()}
        return s


def rehydrate_from_db() -> int:
    """Re-fill the in-memory counters + ring buffer from the llm_call_log
    table so the AI Models page shows history across restarts."""
    init_log_table()
    try:
        with SessionLocal() as s:
            rows = s.query(LLMCallLog).order_by(desc(LLMCallLog.call_id)).limit(500).all()
    except Exception:
        return 0
    if not rows:
        return 0

    with _LOCK:
        # Aggregate counters from ALL historical rows first.
        lifetime = s = None  # noqa: E741  (for linter — re-assigned below)
        for r in reversed(rows):  # replay oldest → newest for correct 'recent' order
            _state["requests_total"] += 1
            bucket = _state["by_endpoint"].setdefault(r.endpoint, {
                "requests": 0, "success": 0, "failure": 0,
                "tokens_prompt": 0, "tokens_completion": 0, "latency_ms": 0,
            })
            bucket["requests"] += 1
            bucket["latency_ms"] += int(r.latency_ms or 0)
            _state["latency_total_ms"] += int(r.latency_ms or 0)
            bucket["tokens_prompt"] += int(r.tokens_prompt or 0)
            bucket["tokens_completion"] += int(r.tokens_completion or 0)
            _state["tokens_prompt"] += int(r.tokens_prompt or 0)
            _state["tokens_completion"] += int(r.tokens_completion or 0)
            if r.ok:
                _state["requests_success"] += 1
                bucket["success"] += 1
            else:
                _state["requests_failure"] += 1
                bucket["failure"] += 1
            if r.decision:
                d = r.decision.upper()
                _state["decisions"][d if d in _state["decisions"] else "OTHER"] += 1
            _state["recent"].appendleft({
                "ts": (r.ts or datetime.now(timezone.utc)).isoformat(),
                "endpoint": r.endpoint,
                "ok": bool(r.ok),
                "status_code": r.status_code,
                "latency_ms": int(r.latency_ms or 0),
                "tokens_prompt": int(r.tokens_prompt or 0),
                "tokens_completion": int(r.tokens_completion or 0),
                "model": r.model,
                "decision": r.decision,
                "prompt_preview": r.prompt_preview or "",
                "response_preview": r.response_preview or "",
                "error": r.error,
            })
    return len(rows)


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
