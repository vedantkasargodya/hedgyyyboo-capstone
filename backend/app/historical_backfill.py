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

# GARCH's compiled `arch` extension has been observed to segfault on
# degenerate windows (near-zero variance, 2020 march flatlines, etc.) —
# enough to kill the whole Python process. We skip it during the backfill
# walk; the live /api/fx/pm pipeline still computes it on fresh data.
GARCH_IN_BACKFILL = False

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
    """Build a signal_packet dict from a historical close series only.
    GARCH is skipped in backfill because the `arch` C++ extension
    occasionally segfaults on degenerate windows and kills the process."""
    rets = closes.pct_change().dropna().values
    log_prices = np.log(closes.values)
    packet: dict[str, Any] = {
        "desk": desk,
        "symbol": symbol,
        "price": price_summary(closes),
    }
    try:
        packet["ou_mle"] = ou_mle(log_prices)
    except Exception as exc:
        packet["ou_mle"] = {"status": f"error:{type(exc).__name__}"}
    try:
        packet["hurst"] = hurst_rs(rets)
    except Exception as exc:
        packet["hurst"] = {"status": f"error:{type(exc).__name__}"}
    if GARCH_IN_BACKFILL:
        try:
            packet["garch"] = garch_forecast(rets)
        except Exception as exc:
            packet["garch"] = {"status": f"error:{type(exc).__name__}"}
    else:
        packet["garch"] = {"status": "skipped_in_backfill"}
    return packet


# (Legacy close-only _simulate_forward / _pnl_pct were replaced by the OHLC
#  variants above which catch intraday stop-outs and apply tx cost haircut.)


def _outcome(entry, exit_p, direction, desk, symbol_or_reason=None, reason=None, held=None, ts=None, symbol=None):
    # Back-compat shim: old callers pass (entry, exit_p, direction, desk, reason, held, ts);
    # new OHLC sim passes (entry, exit_p, direction, desk, symbol=sym, reason=..., held=..., ts=...)
    if reason is None and isinstance(symbol_or_reason, str):
        reason = symbol_or_reason
    if symbol is None:
        sym_arg = None
    else:
        sym_arg = symbol
    gross = _pnl_pct_internal(direction, entry, exit_p, desk, sym_arg)
    # Apply transaction cost haircut (round trip)
    tx = TX_COST_PCT.get(desk, 0.04)
    net = gross - tx
    return {
        "exit_price": float(exit_p),
        "pnl_pct":   round(net, 4),
        "close_reason": reason,
        "held_days": int(held) if held is not None else 0,
        "closed_at": pd.Timestamp(ts).to_pydatetime().astimezone(timezone.utc) if ts is not None else datetime.now(timezone.utc),
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


# Per-trade round-trip transaction cost haircut, as a percentage.  Applied
# in _simulate_forward so the labels reflect "did this trade actually win
# net of spread" not "did it win on clean close prices".
TX_COST_PCT = {DESK_FX: 0.04, DESK_EQUITY: 0.04, DESK_RATES: 0.02}

# Duration-weighted rate conversion for rates PnL.  yfinance yield tickers
# report YIELD in % — a 10 bp move on UST10Y produces ~8.5 × 10 bp = 85 bp
# of bond PnL.  Use approximate modified duration per tenor:
RATES_DURATION = {"UST5Y": 4.5, "UST10Y": 8.5, "UST30Y": 18.0, "UST3M": 0.25}


def _walk_symbol(desk: str, symbol: str, yf_sym: str, years: int = 2) -> int:
    """Crash-proof per-symbol walk.  Any exception inside the window loop
    is caught so one bad window doesn't kill the whole backfill."""
    try:
        hist = yf.Ticker(yf_sym).history(period=f"{years}y", interval="1d")
    except Exception as exc:
        logger.warning("backfill history fetch failed for %s: %s", yf_sym, exc)
        return 0
    if hist is None or hist.empty:
        logger.info("backfill skip %s — no history", yf_sym)
        return 0

    # For OHLC-based intraday stop detection we keep the High/Low bars too
    highs = hist["High"].dropna()
    lows  = hist["Low"].dropna()
    closes = hist["Close"].dropna()

    if len(closes) < LOOKBACK_DAYS + MAX_FORWARD_DAYS:
        logger.info("backfill skip %s — not enough rows (%d)", yf_sym, len(closes))
        return 0

    samples: list[dict[str, Any]] = []

    for t in range(LOOKBACK_DAYS, len(closes) - MAX_FORWARD_DAYS, WINDOW_STEP):
        try:
            window = closes.iloc[t - LOOKBACK_DAYS : t]
            entry_price = float(closes.iloc[t])
            fwd_close = closes.iloc[t + 1 : t + 1 + MAX_FORWARD_DAYS]
            fwd_high  = highs.iloc[t + 1 : t + 1 + MAX_FORWARD_DAYS]
            fwd_low   = lows.iloc[t + 1 : t + 1 + MAX_FORWARD_DAYS]
            if fwd_close.empty:
                continue

            packet = _packet_for_window(desk, symbol, window)
            entry_ts = pd.Timestamp(closes.index[t]).to_pydatetime().astimezone(timezone.utc)

            for direction in ("LONG", "SHORT"):
                out = _simulate_forward_ohlc(desk, direction, entry_price,
                                             fwd_close, fwd_high, fwd_low,
                                             symbol=symbol)
                samples.append({
                    "desk": desk, "symbol": symbol, "direction": direction,
                    "opened_at": entry_ts, "closed_at": out["closed_at"],
                    "entry_price": entry_price, "exit_price": out["exit_price"],
                    "pnl_pct": out["pnl_pct"], "close_reason": out["close_reason"],
                    "held_days": out["held_days"],
                    "signal_packet": packet,
                })
        except Exception as exc:
            logger.warning("backfill %s window t=%d failed: %s", symbol, t, exc)
            continue

    # Batch-upsert per symbol so one failure never loses all progress.
    try:
        with SessionLocal() as s:
            s.query(HistoricalSample).filter(
                HistoricalSample.desk == desk,
                HistoricalSample.symbol == symbol,
            ).delete()
            for row in samples:
                s.add(HistoricalSample(**row))
            s.commit()
    except Exception as exc:
        logger.warning("backfill db write failed for %s/%s: %s", desk, symbol, exc)
        return 0
    logger.info("backfill %s/%s: wrote %d samples", desk, symbol, len(samples))
    return len(samples)


def _simulate_forward_ohlc(
    desk: str,
    direction: str,
    entry_price: float,
    fwd_close: pd.Series,
    fwd_high: pd.Series,
    fwd_low: pd.Series,
    *,
    symbol: str,
) -> dict[str, Any]:
    """OHLC-based forward simulation.  We check stop-loss/take-profit
    against the day's high/low so intraday stop-outs are detected, then
    fall back to the close for open-trade PnL.  Includes transaction
    cost haircut and duration-weighted rates PnL."""
    rules = DESK_RULES.get(desk, DESK_RULES[DESK_FX])
    max_hold = int(rules["max_hold_days"])
    sl = rules["stop_loss_pct"]
    tp = rules["take_profit_pct"]

    peak = 0.0
    for i in range(len(fwd_close)):
        ts = fwd_close.index[i]
        close_price = float(fwd_close.iloc[i])
        high_price  = float(fwd_high.iloc[i])
        low_price   = float(fwd_low.iloc[i])

        # Determine extreme PnL seen intraday for LONG vs SHORT.
        pnl_at_low  = _pnl_pct_internal(direction, entry_price, low_price, desk, symbol)
        pnl_at_high = _pnl_pct_internal(direction, entry_price, high_price, desk, symbol)
        intraday_low  = min(pnl_at_low, pnl_at_high)
        intraday_high = max(pnl_at_low, pnl_at_high)

        # 1. intraday hit stop loss?
        if intraday_low <= sl:
            # Assume fill at the stop (worst case for a retail order)
            stop_price = _price_from_pnl(direction, entry_price, sl, desk, symbol)
            return _outcome(entry_price, stop_price, direction, desk, symbol,
                            reason="STOP_LOSS", held=i + 1, ts=ts)
        # 2. intraday hit take profit?
        if intraday_high >= tp:
            tp_price = _price_from_pnl(direction, entry_price, tp, desk, symbol)
            return _outcome(entry_price, tp_price, direction, desk, symbol,
                            reason="TAKE_PROFIT", held=i + 1, ts=ts)
        # 3. trailing stop (checked against close only — conservative)
        close_pnl = _pnl_pct_internal(direction, entry_price, close_price, desk, symbol)
        peak = max(peak, close_pnl)
        if peak >= 0.40 and (peak - close_pnl) >= 0.20:
            return _outcome(entry_price, close_price, direction, desk, symbol,
                            reason="TRAIL_STOP", held=i + 1, ts=ts)
        # 4. time stop
        if (i + 1) >= max_hold:
            return _outcome(entry_price, close_price, direction, desk, symbol,
                            reason="TIME_STOP", held=i + 1, ts=ts)

    last_ts = fwd_close.index[-1]
    return _outcome(entry_price, float(fwd_close.iloc[-1]), direction, desk, symbol,
                    reason="TIME_STOP", held=len(fwd_close), ts=last_ts)


def _pnl_pct_internal(direction: str, entry: float, current: float, desk: str, symbol: str | None = None) -> float:
    """PnL % with duration weighting for RATES and sign inversion for bonds."""
    if desk == DESK_RATES:
        dur = RATES_DURATION.get(symbol or "", 8.5)
        yield_move = (current - entry)               # in % (yfinance quotes yields in %)
        # LONG a bond profits when yield falls, PnL ~ -duration * yield_move
        sign = -1.0 if direction == "LONG" else 1.0
        return sign * dur * yield_move
    if direction == "LONG":
        return (current - entry) / entry * 100.0
    return (entry - current) / entry * 100.0


def _price_from_pnl(direction: str, entry: float, target_pnl: float, desk: str, symbol: str | None = None) -> float:
    """Inverse of _pnl_pct_internal — used to produce a clean fill price
    at the moment the stop-loss / take-profit condition is met."""
    if desk == DESK_RATES:
        dur = RATES_DURATION.get(symbol or "", 8.5)
        sign = -1.0 if direction == "LONG" else 1.0
        yield_move = target_pnl / (sign * dur)
        return entry + yield_move
    if direction == "LONG":
        return entry * (1.0 + target_pnl / 100.0)
    return entry * (1.0 - target_pnl / 100.0)


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
    """Single entrypoint used by the /api/ml/backfill endpoint.  Each
    symbol is wrapped in try/except so a failure in one cannot abort
    the whole job."""
    import gc
    init_historical_table()
    t0 = _time.time()
    total = 0
    per_symbol: dict[str, int] = {}
    errors: list[str] = []

    def _safe_walk(desk: str, pretty: str, yf_sym: str) -> int:
        try:
            return _walk_symbol(desk, pretty, yf_sym, years=years)
        except Exception as exc:
            msg = f"{desk}/{pretty}: {type(exc).__name__}: {exc}"
            logger.warning("backfill %s", msg)
            errors.append(msg)
            return 0
        finally:
            gc.collect()

    for pretty, yf_sym in _FX_SYMBOLS.items():
        n = _safe_walk(DESK_FX, pretty, yf_sym)
        per_symbol[f"FX:{pretty}"] = n
        total += n

    for pretty, yf_sym in _EQUITY_SYMBOLS.items():
        n = _safe_walk(DESK_EQUITY, pretty, yf_sym)
        per_symbol[f"EQUITY:{pretty}"] = n
        total += n

    for pretty, yf_sym in _RATES_SYMBOLS.items():
        if pretty == "UST3M":
            continue
        n = _safe_walk(DESK_RATES, pretty, yf_sym)
        per_symbol[f"RATES:{pretty}"] = n
        total += n

    elapsed = _time.time() - t0
    return {
        "status": "ok" if not errors else "partial",
        "total_samples": total,
        "per_symbol": per_symbol,
        "errors": errors,
        "elapsed_s": round(elapsed, 1),
    }


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
