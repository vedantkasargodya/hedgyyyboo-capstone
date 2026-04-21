"""
Historical-signal backfill — the hedge-fund trick for bootstrapping an ML
trade screener when you only have a handful of live paper trades.

For every symbol on every desk watchlist, walk ~2 years of daily data.
On each trading day t we:

    1.  Compute the signal packet using ONLY data[0 : t] (no look-ahead).
    2.  Hypothetically open a LONG and a SHORT at the t+1 open.
    3.  Simulate forward up to MAX_HOLD_DAYS applying the same desk-level
        stop-loss / take-profit / time-stop rules the live engine uses.
    4.  Record (features, label=1 if realised pnl > 0 else 0) for both.

Rows are written to a dedicated ``historical_samples`` table so they live
separately from real paper_trades but feed the same XGBoost trainer.
Re-running the backfill is idempotent — we wipe the symbol's rows first.

The point: go from 10 training rows to ~5 000 in minutes.
"""
from __future__ import annotations

import logging
import math
import time as _time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import Column, DateTime, Float, Integer, JSON, String

from app.paper_trades_model import (
    Base, SessionLocal, DESK_EQUITY, DESK_FX, DESK_RATES, DESK_RULES, engine,
)
from app.signal_packet import (
    ou_mle, hurst_rs, garch_forecast, price_summary, _RATES_SYMBOLS,
)

logger = logging.getLogger("hedgyyyboo.historical_backfill")


# ---------------------------------------------------------------------------
# Table: historical_samples
# ---------------------------------------------------------------------------

class HistoricalSample(Base):
    __tablename__ = "historical_samples"

    sample_id   = Column(Integer, primary_key=True, autoincrement=True)
    desk        = Column(String(10), nullable=False)
    symbol      = Column(String(30), nullable=False)
    direction   = Column(String(6),  nullable=False)
    opened_at   = Column(DateTime,   nullable=False)
    closed_at   = Column(DateTime,   nullable=True)
    entry_price = Column(Float,      nullable=False)
    exit_price  = Column(Float,      nullable=True)
    pnl_pct     = Column(Float,      nullable=True)
    close_reason= Column(String(20), nullable=True)
    held_days   = Column(Integer,    nullable=True)
    signal_packet = Column(JSON, nullable=True)


def init_historical_table() -> None:
    Base.metadata.create_all(engine, tables=[HistoricalSample.__table__])


# ---------------------------------------------------------------------------
# Walk-forward generators (no look-ahead)
# ---------------------------------------------------------------------------

# We don't recompute the FULL signal_packet every day (too slow) — we
# compute it on a WINDOWED basis and cache by month.  The packet doesn't
# change much tick-to-tick, and we care about the regime at entry time.

def _packet_for_window(desk: str, symbol: str, closes: pd.Series) -> dict[str, Any]:
    """Build a signal_packet dict from a historical close series only."""
    rets = closes.pct_change().dropna().values
    log_prices = np.log(closes.values)
    return {
        "desk": desk,
        "symbol": symbol,
        "price": price_summary(closes),
        "ou_mle": ou_mle(log_prices),
        "hurst": hurst_rs(rets),
        "garch": garch_forecast(rets),
    }


def _simulate_forward(
    desk: str,
    direction: str,
    entry_price: float,
    forward_prices: pd.Series,
) -> dict[str, Any]:
    """Apply desk-level close rules forward bar-by-bar and return the
    simulated trade outcome."""
    rules = DESK_RULES.get(desk, DESK_RULES[DESK_FX])
    max_hold = int(rules["max_hold_days"])
    sl = rules["stop_loss_pct"]
    tp = rules["take_profit_pct"]

    peak = 0.0
    for i, (ts, price) in enumerate(forward_prices.items(), start=1):
        if i > max_hold:
            return _outcome(entry_price, price, direction, desk, reason="TIME_STOP", held=i, ts=ts)
        pnl = _pnl_pct(direction, entry_price, price, desk)
        peak = max(peak, pnl)
        if pnl <= sl:
            return _outcome(entry_price, price, direction, desk, reason="STOP_LOSS", held=i, ts=ts)
        if pnl >= tp:
            return _outcome(entry_price, price, direction, desk, reason="TAKE_PROFIT", held=i, ts=ts)
        # Simple trailing stop: if up >0.4% then dip 0.2% off peak, close.
        if peak >= 0.40 and (peak - pnl) >= 0.20:
            return _outcome(entry_price, price, direction, desk, reason="TRAIL_STOP", held=i, ts=ts)
        # Time stop: 1 day of no progress
        if i >= 1 and pnl < 0.3 and i == 1:
            continue  # wait at least another day
    # Ran out of forward data
    last_ts = forward_prices.index[-1]
    return _outcome(entry_price, float(forward_prices.iloc[-1]), direction, desk, reason="TIME_STOP", held=len(forward_prices), ts=last_ts)


def _pnl_pct(direction: str, entry: float, current: float, desk: str) -> float:
    if desk == DESK_RATES:
        return ((entry - current) / entry * 100.0) if direction == "LONG" else ((current - entry) / entry * 100.0)
    return ((current - entry) / entry * 100.0) if direction == "LONG" else ((entry - current) / entry * 100.0)


def _outcome(entry, exit_p, direction, desk, reason, held, ts):
    pnl = _pnl_pct(direction, entry, exit_p, desk)
    return {
        "exit_price": float(exit_p),
        "pnl_pct":   round(pnl, 4),
        "close_reason": reason,
        "held_days": int(held),
        "closed_at": pd.Timestamp(ts).to_pydatetime().astimezone(timezone.utc),
    }


# ---------------------------------------------------------------------------
# Per-desk walkers
# ---------------------------------------------------------------------------

_FX_SYMBOLS = {
    "EUR/USD": "EURUSD=X", "USD/JPY": "USDJPY=X", "GBP/USD": "GBPUSD=X",
    "AUD/USD": "AUDUSD=X", "USD/CHF": "USDCHF=X", "EUR/GBP": "EURGBP=X",
}
_EQUITY_SYMBOLS = {s: s for s in ["AAPL", "MSFT", "GOOGL", "NVDA", "META", "TSLA", "JPM"]}

LOOKBACK_DAYS = 252                 # 1 yr rolling window to compute packet
WINDOW_STEP   = 5                   # re-open every 5 days (Friday-to-Friday)
MAX_FORWARD_DAYS = 30               # cap simulation horizon for speed


def _walk_symbol(desk: str, symbol: str, yf_sym: str, years: int = 2) -> int:
    hist = yf.Ticker(yf_sym).history(period=f"{years}y", interval="1d")
    if hist is None or hist.empty:
        logger.info("backfill skip %s — no history", yf_sym)
        return 0
    closes = hist["Close"].dropna()
    if len(closes) < LOOKBACK_DAYS + MAX_FORWARD_DAYS:
        logger.info("backfill skip %s — not enough rows (%d)", yf_sym, len(closes))
        return 0

    samples: list[dict[str, Any]] = []
    # Walk from (LOOKBACK_DAYS) up to (len - MAX_FORWARD_DAYS) in steps.
    for t in range(LOOKBACK_DAYS, len(closes) - MAX_FORWARD_DAYS, WINDOW_STEP):
        window = closes.iloc[t - LOOKBACK_DAYS : t]
        entry_price = float(closes.iloc[t])
        forward = closes.iloc[t + 1 : t + 1 + MAX_FORWARD_DAYS]
        if forward.empty:
            continue

        packet = _packet_for_window(desk, symbol, window)
        entry_ts = pd.Timestamp(closes.index[t]).to_pydatetime().astimezone(timezone.utc)

        for direction in ("LONG", "SHORT"):
            out = _simulate_forward(desk, direction, entry_price, forward)
            samples.append({
                "desk": desk, "symbol": symbol, "direction": direction,
                "opened_at": entry_ts, "closed_at": out["closed_at"],
                "entry_price": entry_price, "exit_price": out["exit_price"],
                "pnl_pct": out["pnl_pct"], "close_reason": out["close_reason"],
                "held_days": out["held_days"],
                "signal_packet": packet,
            })

    # Wipe previous rows for this symbol and rewrite idempotently.
    with SessionLocal() as s:
        s.query(HistoricalSample).filter(
            HistoricalSample.desk == desk,
            HistoricalSample.symbol == symbol,
        ).delete()
        for row in samples:
            s.add(HistoricalSample(**row))
        s.commit()
    logger.info("backfill %s/%s: wrote %d samples", desk, symbol, len(samples))
    return len(samples)


def _walk_rates() -> int:
    """Rates desk uses yield tickers (^TNX etc.) and tenor-specific stops."""
    total = 0
    for pretty, yf_sym in _RATES_SYMBOLS.items():
        # Skip UST3M — we don't actively trade the bill.
        if pretty == "UST3M":
            continue
        total += _walk_symbol(DESK_RATES, pretty, yf_sym, years=2)
    return total


def run_full_backfill(years: int = 2) -> dict[str, Any]:
    """Single entrypoint used by the /api/ml/backfill endpoint."""
    init_historical_table()
    t0 = _time.time()
    total = 0
    per_symbol: dict[str, int] = {}

    for pretty, yf_sym in _FX_SYMBOLS.items():
        n = _walk_symbol(DESK_FX, pretty, yf_sym, years=years)
        per_symbol[f"FX:{pretty}"] = n
        total += n

    for pretty, yf_sym in _EQUITY_SYMBOLS.items():
        n = _walk_symbol(DESK_EQUITY, pretty, yf_sym, years=years)
        per_symbol[f"EQUITY:{pretty}"] = n
        total += n

    total += _walk_rates()
    for pretty, yf_sym in _RATES_SYMBOLS.items():
        if pretty == "UST3M":
            continue
        with SessionLocal() as s:
            per_symbol[f"RATES:{pretty}"] = s.query(HistoricalSample).filter(
                HistoricalSample.desk == DESK_RATES,
                HistoricalSample.symbol == pretty,
            ).count()

    elapsed = _time.time() - t0
    return {"status": "ok", "total_samples": total, "per_symbol": per_symbol, "elapsed_s": round(elapsed, 1)}


# ---------------------------------------------------------------------------
# Load into ML-trainer format
# ---------------------------------------------------------------------------

def load_samples_as_training_rows() -> list[dict[str, Any]]:
    """Return historical rows in the same shape the ML trainer expects from
    list_trades(status='CLOSED') so we can splice them together."""
    rows: list[dict[str, Any]] = []
    with SessionLocal() as s:
        for r in s.query(HistoricalSample).all():
            pkt = r.signal_packet
            if isinstance(pkt, str):
                import json as _json
                try: pkt = _json.loads(pkt)
                except Exception: pkt = {}
            rows.append({
                "trade_id": r.sample_id,
                "desk": r.desk, "symbol": r.symbol, "direction": r.direction,
                "entry_price": r.entry_price, "current_price": r.exit_price,
                "pnl_pct": r.pnl_pct, "pnl_usd": 0.0,
                "status": "CLOSED", "close_reason": r.close_reason,
                "opened_at": r.opened_at.isoformat() if r.opened_at else None,
                "closed_at": r.closed_at.isoformat() if r.closed_at else None,
                "meta": {"source": "historical_backfill", "signal_packet": pkt},
            })
    return rows
