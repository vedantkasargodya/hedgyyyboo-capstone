"""
Hedgyyyboo -- Live stock data via yfinance.

All data is LIVE -- no dummies.
"""

from __future__ import annotations

import logging
from typing import Any

import yfinance as yf

logger = logging.getLogger(__name__)


def get_live_stock_data(ticker: str) -> dict[str, Any]:
    """Fetch live stock quote data for a single ticker."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName", ticker),
            "price": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "change_pct": info.get("regularMarketChangePercent", 0),
            "volume": info.get("regularMarketVolume", 0),
            "market_cap": info.get("marketCap", 0),
            "pe_ratio": info.get("trailingPE"),
            "52w_high": info.get("fiftyTwoWeekHigh", 0),
            "52w_low": info.get("fiftyTwoWeekLow", 0),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "beta": info.get("beta"),
            "dividend_yield": info.get("dividendYield"),
            "avg_volume": info.get("averageVolume", 0),
        }
    except Exception as exc:
        logger.error("Failed to fetch stock data for %s: %s", ticker, exc)
        return {"ticker": ticker.upper(), "error": str(exc)}


def get_stock_chart(ticker: str, period: str = "1mo") -> list[dict[str, Any]]:
    """Fetch historical OHLCV data for charting."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        if hist.empty:
            return []
        return [
            {
                "date": str(d.date()),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"]),
            }
            for d, row in hist.iterrows()
        ]
    except Exception as exc:
        logger.error("Failed to fetch chart for %s: %s", ticker, exc)
        return []


def get_batch_quotes(tickers: list[str]) -> list[dict[str, Any]]:
    """Fetch live quotes for multiple tickers efficiently."""
    results: list[dict[str, Any]] = []
    for t in tickers:
        try:
            stock = yf.Ticker(t)
            # Use history to compute change reliably
            hist = stock.history(period="5d")
            if len(hist) >= 2:
                price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2])
                chg_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
                volume = int(hist["Volume"].iloc[-1])
            elif len(hist) == 1:
                price = float(hist["Close"].iloc[-1])
                chg_pct = 0.0
                volume = int(hist["Volume"].iloc[-1])
            else:
                price = 0.0
                chg_pct = 0.0
                volume = 0

            results.append({
                "symbol": t.upper(),
                "price": round(price, 2),
                "change_pct": round(chg_pct, 2),
                "volume": volume,
            })
        except Exception as exc:
            logger.warning("Batch quote failed for %s: %s", t, exc)
            results.append({"symbol": t.upper(), "price": 0, "change_pct": 0, "volume": 0})
    return results
