"""
Hedgyyyboo Phase 6 — FX Macro Data Ingestion.

Live FX spot rates, yield differentials, and macro data
from yfinance and FRED via pandas_datareader.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.fx_data")

# ---------------------------------------------------------------------------
# FX Pairs (yfinance format)
# ---------------------------------------------------------------------------

FX_PAIRS: dict[str, str] = {
    "EUR/USD": "EURUSD=X",
    "USD/JPY": "JPY=X",
    "GBP/USD": "GBPUSD=X",
    "USD/INR": "INR=X",
    "AUD/USD": "AUDUSD=X",
    "USD/CHF": "CHF=X",
}

# Yield proxies for carry trade differential
YIELD_TICKERS: dict[str, str] = {
    "US_3M": "^IRX",
    "US_10Y": "^TNX",
    "US_30Y": "^TYX",
}


def get_fx_spot_rates() -> dict[str, Any]:
    """Fetch live FX spot rates from yfinance."""
    rates: list[dict[str, Any]] = []

    for pair_name, yf_symbol in FX_PAIRS.items():
        try:
            tk = yf.Ticker(yf_symbol)
            hist = tk.history(period="5d")
            if hist.empty:
                continue

            price = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
            chg = price - prev
            chg_pct = (chg / prev * 100) if prev else 0

            # Get 30-day history for sparkline
            hist_30 = tk.history(period="1mo")
            sparkline = [round(float(c), 5) for c in hist_30["Close"].values[-30:]]

            rates.append({
                "pair": pair_name,
                "symbol": yf_symbol,
                "price": round(price, 5),
                "change": round(chg, 5),
                "change_pct": round(chg_pct, 3),
                "direction": "up" if chg >= 0 else "down",
                "sparkline": sparkline,
            })

        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", pair_name, exc)

    return {"pairs": rates, "fetched_at": datetime.now().isoformat()}


def get_fx_history(pair: str = "EUR/USD", period: str = "6mo") -> dict[str, Any]:
    """Fetch historical FX data for OU/Hurst analysis."""
    yf_symbol = FX_PAIRS.get(pair)
    if not yf_symbol:
        raise ValueError(f"Unknown pair: {pair}")

    tk = yf.Ticker(yf_symbol)
    hist = tk.history(period=period)

    if hist.empty:
        raise ValueError(f"No history for {pair}")

    data = []
    for date, row in hist.iterrows():
        data.append({
            "date": date.strftime("%Y-%m-%d"),
            "close": round(float(row["Close"]), 6),
            "high": round(float(row["High"]), 6),
            "low": round(float(row["Low"]), 6),
            "volume": int(row["Volume"]) if row["Volume"] else 0,
        })

    closes = np.array([d["close"] for d in data])
    returns = np.diff(np.log(closes))
    realised_vol = float(np.std(returns) * np.sqrt(252))

    return {
        "pair": pair,
        "period": period,
        "data_points": len(data),
        "data": data,
        "current_price": data[-1]["close"] if data else 0,
        "realised_vol_annualised": round(realised_vol, 6),
    }


def get_yield_differentials() -> dict[str, Any]:
    """Fetch US yields and compute differentials for carry analysis."""
    yields: dict[str, float | None] = {}

    for name, symbol in YIELD_TICKERS.items():
        try:
            tk = yf.Ticker(symbol)
            hist = tk.history(period="5d")
            if not hist.empty:
                yields[name] = round(float(hist["Close"].iloc[-1]), 4)
            else:
                yields[name] = None
        except Exception as exc:
            logger.warning("Yield fetch failed for %s: %s", name, exc)
            yields[name] = None

    # Compute real yield differential (US vs proxied foreign)
    # Using 10Y-3M as term premium
    us_10y = yields.get("US_10Y", 0) or 0
    us_3m = yields.get("US_3M", 0) or 0
    term_premium = round(us_10y - us_3m, 4) if us_10y and us_3m else None

    return {
        "yields": yields,
        "term_premium": term_premium,
        "fetched_at": datetime.now().isoformat(),
    }


def get_fx_realised_vol_series(pair: str = "EUR/USD", window: int = 20) -> list[float]:
    """Get rolling realised volatility series for Hurst analysis."""
    yf_symbol = FX_PAIRS.get(pair)
    if not yf_symbol:
        raise ValueError(f"Unknown pair: {pair}")

    tk = yf.Ticker(yf_symbol)
    hist = tk.history(period="1y")

    if len(hist) < window + 10:
        raise ValueError(f"Insufficient data for {pair}")

    closes = hist["Close"].values
    log_returns = np.diff(np.log(closes))

    # Rolling realised vol (annualised)
    vol_series = []
    for i in range(window, len(log_returns)):
        window_returns = log_returns[i - window:i]
        vol = float(np.std(window_returns) * np.sqrt(252))
        vol_series.append(vol)

    return vol_series
