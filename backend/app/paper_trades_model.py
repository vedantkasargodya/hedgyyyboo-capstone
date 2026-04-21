"""
Unified multi-desk paper-trade ledger.

We keep the legacy ``fx_paper_trades`` table untouched for backwards
compatibility with the /api/fx/* endpoints, but every new trade — FX,
equity, or rates — is now recorded in this single ``paper_trades`` table.
The portfolio summary and the auto-trade engine only look at this unified
table.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    desc,
)
from sqlalchemy.orm import Session

from app.trade_ledger import Base, engine, SessionLocal, FXPaperTrade

logger = logging.getLogger("hedgyyyboo.paper_trades_model")

# --------- Desk constants ---------
DESK_FX = "FX"
DESK_EQUITY = "EQUITY"
DESK_RATES = "RATES"
VALID_DESKS = {DESK_FX, DESK_EQUITY, DESK_RATES}

# --------- Close reasons ---------
CLOSE_STOP_LOSS = "STOP_LOSS"
CLOSE_TAKE_PROFIT = "TAKE_PROFIT"
CLOSE_TIME_STOP = "TIME_STOP"
CLOSE_SIGNAL_REVERSAL = "SIGNAL_REVERSAL"
CLOSE_MANUAL = "MANUAL"
CLOSE_LLM = "LLM_DECISION"

# --------- Desk-specific risk parameters ---------
DESK_RULES = {
    DESK_FX: {
        "stop_loss_pct": -2.0,
        "take_profit_pct": 1.5,
        "max_hold_days": 30,
        "notional_usd": 100_000.0,
    },
    DESK_EQUITY: {
        "stop_loss_pct": -4.0,
        "take_profit_pct": 5.0,
        "max_hold_days": 90,
        "notional_usd": 50_000.0,
    },
    DESK_RATES: {
        "stop_loss_pct": -1.0,
        "take_profit_pct": 0.75,
        "max_hold_days": 180,
        "notional_usd": 250_000.0,
    },
}


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    trade_id      = Column(Integer, primary_key=True, autoincrement=True)
    desk          = Column(String(10), nullable=False)       # FX / EQUITY / RATES
    symbol        = Column(String(30), nullable=False)       # e.g. "EUR/USD", "AAPL", "UST10Y"
    direction     = Column(String(6), nullable=False)        # LONG / SHORT
    notional_usd  = Column(Float, nullable=False, default=100_000.0)
    entry_price   = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    pnl_pct       = Column(Float, nullable=True, default=0.0)
    pnl_usd       = Column(Float, nullable=True, default=0.0)
    rationale     = Column(Text, nullable=True)
    status        = Column(String(10), nullable=False, default="OPEN")
    close_reason  = Column(String(30), nullable=True)
    opened_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at     = Column(DateTime, nullable=True)
    meta          = Column(JSON, nullable=True, default=dict)  # desk-specific extras


def init_unified_table() -> None:
    """Create the unified paper_trades table (if missing) and backfill any
    existing rows from the legacy fx_paper_trades table exactly once."""
    Base.metadata.create_all(engine)

    with SessionLocal() as s:
        unified_count = s.query(PaperTrade).count()
        if unified_count > 0:
            logger.info("paper_trades already populated (%d rows)", unified_count)
            return

        legacy_rows = s.query(FXPaperTrade).all()
        if not legacy_rows:
            logger.info("No legacy fx_paper_trades rows to migrate")
            return

        for lg in legacy_rows:
            s.add(PaperTrade(
                desk=DESK_FX,
                symbol=lg.pair,
                direction=lg.direction,
                notional_usd=DESK_RULES[DESK_FX]["notional_usd"],
                entry_price=lg.entry_price,
                current_price=lg.current_price,
                pnl_pct=lg.pnl_pct or 0.0,
                pnl_usd=(lg.pnl_pct or 0.0) / 100.0 * DESK_RULES[DESK_FX]["notional_usd"],
                rationale=lg.rationale,
                status=lg.status,
                opened_at=lg.opened_at,
                closed_at=lg.closed_at,
                meta={
                    "ou_half_life": lg.ou_half_life,
                    "hurst_exponent": lg.hurst_exponent,
                    "neural_sde_drift": lg.neural_sde_drift,
                    "forex_factory_event": lg.forex_factory_event,
                    "hawkish_score": lg.hawkish_score,
                },
            ))
        s.commit()
        logger.info("Migrated %d legacy FX trade(s) into paper_trades", len(legacy_rows))


# ----------------------------------------------------------------------
# CRUD helpers (used by the trade engine + the /api/trades endpoints)
# ----------------------------------------------------------------------

def _row_to_dict(t: PaperTrade) -> dict[str, Any]:
    # SQLAlchemy JSON column comes back as dict already; but if the DB
    # driver returned a string, decode it defensively.
    meta = t.meta
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    return {
        "trade_id": t.trade_id,
        "desk": t.desk,
        "symbol": t.symbol,
        "direction": t.direction,
        "notional_usd": t.notional_usd,
        "entry_price": t.entry_price,
        "current_price": t.current_price,
        "pnl_pct": t.pnl_pct,
        "pnl_usd": t.pnl_usd,
        "rationale": t.rationale,
        "status": t.status,
        "close_reason": t.close_reason,
        "opened_at": t.opened_at.isoformat() if t.opened_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        "meta": meta or {},
    }


def insert_trade(
    *,
    desk: str,
    symbol: str,
    direction: str,
    entry_price: float,
    notional_usd: float | None = None,
    rationale: str = "",
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if desk not in VALID_DESKS:
        raise ValueError(f"Invalid desk: {desk}; expected one of {VALID_DESKS}")
    if direction not in ("LONG", "SHORT"):
        raise ValueError(f"direction must be LONG or SHORT, got {direction!r}")
    notional = notional_usd or DESK_RULES[desk]["notional_usd"]

    with SessionLocal() as s:
        t = PaperTrade(
            desk=desk,
            symbol=symbol,
            direction=direction,
            notional_usd=notional,
            entry_price=entry_price,
            current_price=entry_price,
            pnl_pct=0.0,
            pnl_usd=0.0,
            rationale=rationale,
            status="OPEN",
            meta=meta or {},
        )
        s.add(t)
        s.commit()
        s.refresh(t)
        logger.info(
            "OPEN  [%s] #%d %s %s @ %.5f (notional $%.0f) — %s",
            desk, t.trade_id, direction, symbol, entry_price, notional,
            (rationale or "")[:80],
        )
        return _row_to_dict(t)


def close_trade(trade_id: int, exit_price: float, reason: str = CLOSE_MANUAL) -> dict[str, Any] | None:
    with SessionLocal() as s:
        t = s.query(PaperTrade).filter(PaperTrade.trade_id == trade_id).first()
        if not t or t.status == "CLOSED":
            return None
        t.current_price = exit_price
        t.pnl_pct, t.pnl_usd = _compute_pnl(t.direction, t.entry_price, exit_price, t.notional_usd)
        t.status = "CLOSED"
        t.close_reason = reason
        t.closed_at = datetime.now(timezone.utc)
        s.commit()
        s.refresh(t)
        logger.info(
            "CLOSE [%s] #%d %s %s @ %.5f — PnL %.2f%% ($%.2f) — reason=%s",
            t.desk, t.trade_id, t.direction, t.symbol, exit_price,
            t.pnl_pct, t.pnl_usd, reason,
        )
        return _row_to_dict(t)


def update_price(trade_id: int, current_price: float) -> dict[str, Any] | None:
    with SessionLocal() as s:
        t = s.query(PaperTrade).filter(PaperTrade.trade_id == trade_id).first()
        if not t or t.status == "CLOSED":
            return None
        t.current_price = current_price
        t.pnl_pct, t.pnl_usd = _compute_pnl(t.direction, t.entry_price, current_price, t.notional_usd)
        s.commit()
        s.refresh(t)
        return _row_to_dict(t)


def _compute_pnl(direction: str, entry: float, current: float, notional: float) -> tuple[float, float]:
    if direction == "LONG":
        pct = (current - entry) / entry * 100.0
    else:
        pct = (entry - current) / entry * 100.0
    usd = pct / 100.0 * notional
    return round(pct, 4), round(usd, 2)


def list_trades(status: str | None = None, desk: str | None = None, limit: int = 500) -> list[dict[str, Any]]:
    with SessionLocal() as s:
        q = s.query(PaperTrade)
        if status is not None:
            q = q.filter(PaperTrade.status == status)
        if desk is not None:
            q = q.filter(PaperTrade.desk == desk)
        rows = q.order_by(desc(PaperTrade.opened_at)).limit(limit).all()
        return [_row_to_dict(t) for t in rows]


def get_trade(trade_id: int) -> dict[str, Any] | None:
    with SessionLocal() as s:
        t = s.query(PaperTrade).filter(PaperTrade.trade_id == trade_id).first()
        return _row_to_dict(t) if t else None


def open_session() -> Session:
    """Exposed for the trade engine to run batch updates inside a txn."""
    return SessionLocal()
