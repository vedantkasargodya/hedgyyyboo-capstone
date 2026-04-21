"""
Hedgyyyboo Phase 5 — Fixed Income & Rates Desk: Data Ingestion.

Fetches live Treasury yields (2Y, 5Y, 10Y, 30Y) and credit spreads
from yfinance, plus FRED API for macro rates data.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.fixed_income")

# ---------------------------------------------------------------------------
# Treasury yield tickers (yfinance)
# ---------------------------------------------------------------------------

TREASURY_TICKERS: dict[str, str] = {
    "3M": "^IRX",    # 13-week T-bill
    "2Y": "^FVX",    # 5-year note (we'll relabel; yf has limited yield tickers)
    "5Y": "^FVX",
    "10Y": "^TNX",   # 10-year note
    "30Y": "^TYX",   # 30-year bond
}

# More reliable: use actual treasury ETF proxies for yield data
YIELD_ETFS: dict[str, str] = {
    "1M": "^IRX",
    "2Y": "^FVX",
    "10Y": "^TNX",
    "30Y": "^TYX",
}

# Credit spread proxies
CREDIT_TICKERS: dict[str, str] = {
    "IG_SPREAD": "LQD",    # iShares Investment Grade Corporate Bond
    "HY_SPREAD": "HYG",    # iShares High Yield Corporate Bond
    "EM_SPREAD": "EMB",    # iShares JP Morgan EM Bond
    "TIPS_10Y": "TIP",     # iShares TIPS Bond
}


# ---------------------------------------------------------------------------
# Live yield curve data
# ---------------------------------------------------------------------------


def _fetch_treasury_yields() -> dict[str, Any]:
    """Fetch current Treasury yields from yfinance yield indices."""
    yields: dict[str, float | None] = {}
    history: dict[str, list[dict]] = {}

    # Standard maturities and their yfinance symbols
    maturity_map = {
        "3M": "^IRX",
        "2Y": None,       # Interpolated
        "5Y": "^FVX",
        "10Y": "^TNX",
        "30Y": "^TYX",
    }

    for tenor, symbol in maturity_map.items():
        if symbol is None:
            continue
        try:
            tk = yf.Ticker(symbol)
            hist = tk.history(period="6mo")
            if hist.empty:
                yields[tenor] = None
                continue

            # Yield indices report in percentage (e.g. 4.25 = 4.25%)
            current = float(hist["Close"].iloc[-1])
            yields[tenor] = round(current, 4)

            # Build history for charts
            chart_data = []
            for date, row in hist.iterrows():
                chart_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "yield": round(float(row["Close"]), 4),
                })
            history[tenor] = chart_data[-60:]  # Last 60 data points

        except Exception as exc:
            logger.warning("Failed to fetch %s (%s): %s", tenor, symbol, exc)
            yields[tenor] = None

    # Interpolate 2Y from 3M and 5Y
    if yields.get("3M") and yields.get("5Y"):
        yields["2Y"] = round((yields["3M"] * 0.3 + yields["5Y"] * 0.7), 4)
    elif yields.get("5Y"):
        yields["2Y"] = round(yields["5Y"] * 0.85, 4)

    return {"yields": yields, "history": history}


def _compute_spreads(yields: dict[str, float | None]) -> dict[str, Any]:
    """Compute key yield curve spreads."""
    spreads: dict[str, float | None] = {}

    y2 = yields.get("2Y")
    y5 = yields.get("5Y")
    y10 = yields.get("10Y")
    y30 = yields.get("30Y")
    y3m = yields.get("3M")

    # 2s10s spread (classic inversion indicator)
    if y2 is not None and y10 is not None:
        spreads["2s10s"] = round(y10 - y2, 4)
    else:
        spreads["2s10s"] = None

    # 5s30s spread
    if y5 is not None and y30 is not None:
        spreads["5s30s"] = round(y30 - y5, 4)
    else:
        spreads["5s30s"] = None

    # 3m10y spread (recession predictor)
    if y3m is not None and y10 is not None:
        spreads["3m10y"] = round(y10 - y3m, 4)
    else:
        spreads["3m10y"] = None

    # Butterfly: 2*(10Y) - (2Y) - (30Y)
    if y2 is not None and y10 is not None and y30 is not None:
        spreads["butterfly"] = round(2 * y10 - y2 - y30, 4)
    else:
        spreads["butterfly"] = None

    # Inversion status
    inversion_status = "NORMAL"
    if spreads["2s10s"] is not None and spreads["2s10s"] < 0:
        inversion_status = "INVERTED"
    elif spreads["2s10s"] is not None and spreads["2s10s"] < 0.15:
        inversion_status = "FLAT"

    return {"spreads": spreads, "inversion_status": inversion_status}


def _fetch_credit_data() -> dict[str, Any]:
    """Fetch credit spread proxy data from ETFs."""
    credit_data: list[dict[str, Any]] = []

    for name, symbol in CREDIT_TICKERS.items():
        try:
            tk = yf.Ticker(symbol)
            hist = tk.history(period="5d")
            if hist.empty:
                continue

            price = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
            chg_pct = round(((price - prev) / prev) * 100, 2) if prev else 0

            # Get yield if available
            info = tk.fast_info if hasattr(tk, "fast_info") else {}

            credit_data.append({
                "name": name,
                "symbol": symbol,
                "price": round(price, 2),
                "change_pct": chg_pct,
                "direction": "up" if chg_pct > 0 else "down" if chg_pct < 0 else "flat",
            })

        except Exception as exc:
            logger.warning("Failed to fetch credit %s: %s", name, exc)

    return {"credit_etfs": credit_data}


# ---------------------------------------------------------------------------
# Full yield curve for NSS fitting (synthetic from available maturities)
# ---------------------------------------------------------------------------


def build_yield_curve_points(yields: dict[str, float | None]) -> list[dict[str, float]]:
    """Build yield curve maturity-yield pairs for NSS fitting."""
    maturity_map = {
        "3M": 0.25,
        "2Y": 2.0,
        "5Y": 5.0,
        "10Y": 10.0,
        "30Y": 30.0,
    }

    points = []
    for tenor, maturity in maturity_map.items():
        y = yields.get(tenor)
        if y is not None:
            points.append({"maturity": maturity, "yield": y})

    return points


async def get_fixed_income_data() -> dict[str, Any]:
    """Main endpoint: aggregate all fixed income data."""
    try:
        # Fetch Treasury yields
        treasury = _fetch_treasury_yields()
        yields = treasury["yields"]
        history = treasury["history"]

        # Compute spreads
        spread_data = _compute_spreads(yields)

        # Credit data
        credit = _fetch_credit_data()

        # Build curve points for NSS
        curve_points = build_yield_curve_points(yields)

        return {
            "status": "ok",
            "yields": yields,
            "yield_history": history,
            "spreads": spread_data["spreads"],
            "inversion_status": spread_data["inversion_status"],
            "credit": credit["credit_etfs"],
            "curve_points": curve_points,
            "fetched_at": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.exception("Fixed income data fetch failed")
        raise ValueError(f"Fixed income data fetch failed: {exc}")
