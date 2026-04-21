"""
Portfolio summary — computes real AUM, active positions, realised / unrealised
PnL, Sharpe and other stat-card numbers from the SQLite trade ledger + live
market data.  Replaces the old hardcoded placeholder values.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from app.trade_ledger import get_all_trades, get_open_trades

logger = logging.getLogger("hedgyyyboo.portfolio")

# Every FX paper trade assumes a 100k notional book slot (standard lot size).
# This is the convention on the FX desk; when we add equity / rates trades we
# will attach a per-trade notional to the ledger row.
DEFAULT_FX_NOTIONAL_USD = 100_000.0
# Seed cash the book starts with (the "21 M" had been hard-coded — we reduce
# it to 1 M so the PnL number is actually meaningful against our trade sizes).
SEED_CASH_USD = 1_000_000.0


def _safe_mean(xs: list[float]) -> float:
    xs = [x for x in xs if x is not None and not math.isnan(x)]
    return sum(xs) / len(xs) if xs else 0.0


def _std(xs: list[float]) -> float:
    xs = [x for x in xs if x is not None and not math.isnan(x)]
    if len(xs) < 2:
        return 0.0
    mu = sum(xs) / len(xs)
    var = sum((x - mu) ** 2 for x in xs) / (len(xs) - 1)
    return math.sqrt(var)


def _fetch_vix() -> float | None:
    """Pull a live ^VIX close from Yahoo Finance.  Returns None on any failure."""
    try:
        import yfinance as yf
        hist = yf.Ticker("^VIX").history(period="5d")
        if hist is None or hist.empty:
            return None
        return float(hist["Close"].iloc[-1])
    except Exception as exc:           # pragma: no cover
        logger.warning("VIX fetch failed: %s", exc)
        return None


def compute_portfolio_summary() -> dict[str, Any]:
    """The single source of truth for every stat card on the Main dashboard."""
    open_trades = get_open_trades()
    all_trades = get_all_trades(limit=500)
    closed_trades = [t for t in all_trades if t.get("status") == "CLOSED"]

    # ----- AUM and gross exposure -----------------------------------------
    gross_exposure = DEFAULT_FX_NOTIONAL_USD * len(open_trades)
    unrealised_usd = sum(
        DEFAULT_FX_NOTIONAL_USD * (t.get("pnl_pct") or 0.0) / 100.0
        for t in open_trades
    )
    realised_usd = sum(
        DEFAULT_FX_NOTIONAL_USD * (t.get("pnl_pct") or 0.0) / 100.0
        for t in closed_trades
    )
    aum_usd = SEED_CASH_USD + realised_usd + unrealised_usd

    # ----- Realised Sharpe (approx, on closed trades) ---------------------
    closed_returns = [t.get("pnl_pct") or 0.0 for t in closed_trades]
    mean_ret = _safe_mean(closed_returns)
    std_ret = _std(closed_returns)
    # Annualise crudely — each trade is ~1 day holding, 252 trading days/yr.
    sharpe = (mean_ret / std_ret * math.sqrt(252)) if std_ret > 0 else None

    # ----- Alpha vs benchmark ---------------------------------------------
    # Proper alpha requires a benchmark series (DXY for FX book) over the
    # same window.  Until that wiring lands we return None and the UI shows
    # "N/A" rather than inventing a number.
    alpha_pct = None

    # ----- Risk score (0-100) --------------------------------------------
    # Composite: concentration (more open trades = more concentrated), VIX,
    # absolute unrealised PnL swing.  Clipped into [0, 100].
    vix = _fetch_vix()
    concentration = min(100, 5 * len(open_trades))            # 20 trades = 100
    vix_component = (vix or 18.0) * 2.5                        # 40 vix ≈ 100
    pnl_stress = min(100, abs(unrealised_usd) / (SEED_CASH_USD * 0.02) * 100)
    risk_score = round(min(100, (concentration + vix_component + pnl_stress) / 3), 1)

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "aum_usd": round(aum_usd, 2),
        "seed_cash_usd": SEED_CASH_USD,
        "gross_exposure_usd": round(gross_exposure, 2),
        "open_positions": len(open_trades),
        "closed_trades": len(closed_trades),
        "unrealised_usd": round(unrealised_usd, 2),
        "realised_usd": round(realised_usd, 2),
        "unrealised_pct_of_aum": round(
            unrealised_usd / aum_usd * 100 if aum_usd > 0 else 0.0, 3
        ),
        "realised_sharpe": round(sharpe, 2) if sharpe is not None else None,
        "alpha_pct": alpha_pct,                                 # None until benchmark wired
        "vix": round(vix, 2) if vix is not None else None,
        "risk_score": risk_score,
        "assumptions": {
            "fx_notional_per_trade_usd": DEFAULT_FX_NOTIONAL_USD,
            "seed_cash_usd": SEED_CASH_USD,
            "sharpe_basis": "closed paper-trade returns, √252 annualisation",
            "alpha_status": "not computed — DXY benchmark wiring is pending",
        },
    }
