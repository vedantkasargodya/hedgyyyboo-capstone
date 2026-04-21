"""
Hedgyyyboo Phase 6 — Autonomous Trade Ledger (SQLAlchemy + SQLite/PostgreSQL).

Manages the fx_paper_trades table for the AI PM to log and track
autonomous FX trades with full quant rationale.

Supports PostgreSQL (production) or SQLite (dev fallback).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    desc,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger("hedgyyyboo.trade_ledger")

# ---------------------------------------------------------------------------
# Database URL — PostgreSQL preferred, SQLite fallback
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///hedgyyyboo_trades.db",
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    pass


class FXPaperTrade(Base):
    __tablename__ = "fx_paper_trades"

    trade_id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String(10), nullable=False)          # e.g. "EUR/USD"
    direction = Column(String(5), nullable=False)       # "LONG" or "SHORT"
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    pnl_pct = Column(Float, nullable=True, default=0.0)
    ou_half_life = Column(Float, nullable=True)         # OU mean-reversion half-life (days)
    hurst_exponent = Column(Float, nullable=True)       # Hurst H < 0.5 = rough
    neural_sde_drift = Column(Float, nullable=True)     # Neural SDE learned drift
    rationale = Column(Text, nullable=True)             # AI PM 2-sentence rationale
    status = Column(String(10), nullable=False, default="OPEN")  # OPEN / CLOSED
    opened_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime, nullable=True)
    forex_factory_event = Column(Text, nullable=True)   # Triggering economic event
    hawkish_score = Column(Float, nullable=True)        # CB NLP score


# ---------------------------------------------------------------------------
# Initialize database
# ---------------------------------------------------------------------------


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(engine)
    logger.info("Trade ledger database initialised: %s", DATABASE_URL)


# ---------------------------------------------------------------------------
# CRUD Operations
# ---------------------------------------------------------------------------


def insert_trade(trade_data: dict[str, Any]) -> dict[str, Any]:
    """Insert a new paper trade into the ledger."""
    with SessionLocal() as session:
        trade = FXPaperTrade(
            pair=trade_data["pair"],
            direction=trade_data["direction"],
            entry_price=trade_data["entry_price"],
            current_price=trade_data.get("current_price", trade_data["entry_price"]),
            pnl_pct=0.0,
            ou_half_life=trade_data.get("ou_half_life"),
            hurst_exponent=trade_data.get("hurst_exponent"),
            neural_sde_drift=trade_data.get("neural_sde_drift"),
            rationale=trade_data.get("rationale"),
            status="OPEN",
            forex_factory_event=trade_data.get("forex_factory_event"),
            hawkish_score=trade_data.get("hawkish_score"),
        )
        session.add(trade)
        session.commit()
        session.refresh(trade)

        logger.info("Trade #%d inserted: %s %s @ %.5f", trade.trade_id, trade.direction, trade.pair, trade.entry_price)

        return _trade_to_dict(trade)


def get_open_trades() -> list[dict[str, Any]]:
    """Get all open trades."""
    with SessionLocal() as session:
        trades = session.query(FXPaperTrade).filter(
            FXPaperTrade.status == "OPEN"
        ).order_by(desc(FXPaperTrade.opened_at)).all()
        return [_trade_to_dict(t) for t in trades]


def get_all_trades(limit: int = 50) -> list[dict[str, Any]]:
    """Get all trades (open + closed)."""
    with SessionLocal() as session:
        trades = session.query(FXPaperTrade).order_by(
            desc(FXPaperTrade.opened_at)
        ).limit(limit).all()
        return [_trade_to_dict(t) for t in trades]


def update_trade_price(trade_id: int, current_price: float) -> dict[str, Any] | None:
    """Update a trade's current price and PnL."""
    with SessionLocal() as session:
        trade = session.query(FXPaperTrade).filter(FXPaperTrade.trade_id == trade_id).first()
        if not trade:
            return None

        trade.current_price = current_price

        # Calculate PnL %
        if trade.direction == "LONG":
            trade.pnl_pct = round(((current_price - trade.entry_price) / trade.entry_price) * 100, 4)
        else:  # SHORT
            trade.pnl_pct = round(((trade.entry_price - current_price) / trade.entry_price) * 100, 4)

        session.commit()
        session.refresh(trade)
        return _trade_to_dict(trade)


def close_trade(trade_id: int, exit_price: float) -> dict[str, Any] | None:
    """Close a trade."""
    with SessionLocal() as session:
        trade = session.query(FXPaperTrade).filter(FXPaperTrade.trade_id == trade_id).first()
        if not trade:
            return None

        trade.current_price = exit_price
        trade.status = "CLOSED"
        trade.closed_at = datetime.now(timezone.utc)

        if trade.direction == "LONG":
            trade.pnl_pct = round(((exit_price - trade.entry_price) / trade.entry_price) * 100, 4)
        else:
            trade.pnl_pct = round(((trade.entry_price - exit_price) / trade.entry_price) * 100, 4)

        session.commit()
        session.refresh(trade)

        logger.info("Trade #%d CLOSED: %s %s PnL=%.4f%%", trade.trade_id, trade.direction, trade.pair, trade.pnl_pct)
        return _trade_to_dict(trade)


def update_all_open_prices(live_prices: dict[str, float]) -> list[dict[str, Any]]:
    """Batch update all open trades with live prices."""
    updated = []
    with SessionLocal() as session:
        open_trades = session.query(FXPaperTrade).filter(FXPaperTrade.status == "OPEN").all()
        for trade in open_trades:
            pair_key = trade.pair.replace("/", "")  # EUR/USD -> EURUSD
            price = live_prices.get(pair_key) or live_prices.get(trade.pair)
            if price:
                trade.current_price = price
                if trade.direction == "LONG":
                    trade.pnl_pct = round(((price - trade.entry_price) / trade.entry_price) * 100, 4)
                else:
                    trade.pnl_pct = round(((trade.entry_price - price) / trade.entry_price) * 100, 4)
                updated.append(_trade_to_dict(trade))
        session.commit()
    return updated


def _trade_to_dict(trade: FXPaperTrade) -> dict[str, Any]:
    """Convert ORM object to dict."""
    return {
        "trade_id": trade.trade_id,
        "pair": trade.pair,
        "direction": trade.direction,
        "entry_price": trade.entry_price,
        "current_price": trade.current_price,
        "pnl_pct": trade.pnl_pct,
        "ou_half_life": trade.ou_half_life,
        "hurst_exponent": trade.hurst_exponent,
        "neural_sde_drift": trade.neural_sde_drift,
        "rationale": trade.rationale,
        "status": trade.status,
        "opened_at": trade.opened_at.isoformat() if trade.opened_at else None,
        "closed_at": trade.closed_at.isoformat() if trade.closed_at else None,
        "forex_factory_event": trade.forex_factory_event,
        "hawkish_score": trade.hawkish_score,
    }
