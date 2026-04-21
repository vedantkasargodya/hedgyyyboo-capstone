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

from app.paper_trades_model import list_trades

logger = logging.getLogger("hedgyyyboo.portfolio")

# Seed cash the book starts with (previously hard-coded $21M which made
# the PnL impossible to move).  $1M makes per-trade PnL visible.
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
    open_trades   = list_trades(status="OPEN")
    closed_trades = list_trades(status="CLOSED")

    # Per-desk concentration (for the drill-down widget + the risk score).
    by_desk: dict[str, int] = {}
    for t in open_trades:
        by_desk[t["desk"]] = by_desk.get(t["desk"], 0) + 1

    # ----- AUM and gross exposure -----------------------------------------
    gross_exposure = sum((t.get("notional_usd") or 0.0) for t in open_trades)
    unrealised_usd = sum((t.get("pnl_usd") or 0.0) for t in open_trades)
    realised_usd   = sum((t.get("pnl_usd") or 0.0) for t in closed_trades)
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
        "open_by_desk": by_desk,
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
            "seed_cash_usd": SEED_CASH_USD,
            "notional_convention": "per-trade notional stored on each row of paper_trades",
            "sharpe_basis": "closed paper-trade returns, √252 annualisation",
            "alpha_status": "not computed — DXY benchmark wiring is pending",
        },
    }
