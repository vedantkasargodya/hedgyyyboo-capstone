"""
Hedgyyyboo -- Historical alpha back-check using yfinance.

Checks stock performance after SEC filing dates to validate
whether high divergence scores predicted moves.  ALL LIVE DATA.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import yfinance as yf

logger = logging.getLogger(__name__)


def check_post_filing_alpha(
    ticker: str,
    filing_date: str,
    window_days: int = 30,
) -> dict[str, Any]:
    """Check stock performance after a filing date.

    Parameters
    ----------
    ticker:
        Stock ticker symbol.
    filing_date:
        Date string (YYYY-MM-DD) of the filing.
    window_days:
        Number of days after filing to measure.

    Returns
    -------
    Dict with absolute return, SPY return, and alpha.
    """
    try:
        fd = datetime.strptime(filing_date, "%Y-%m-%d")
    except ValueError:
        return {"ticker": ticker, "filing_date": filing_date, "data_available": False, "error": "Invalid date format"}

    start = fd - timedelta(days=5)
    end = fd + timedelta(days=window_days + 5)

    try:
        stock_hist = yf.Ticker(ticker).history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
        spy_hist = yf.Ticker("SPY").history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))

        if stock_hist.empty or spy_hist.empty:
            return {
                "ticker": ticker,
                "filing_date": filing_date,
                "data_available": False,
                "error": "Insufficient price data",
            }

        # Find price on/before filing date
        stock_dates = stock_hist.index
        filing_ts = fd.replace(tzinfo=stock_dates[0].tzinfo) if stock_dates[0].tzinfo else fd

        before_dates = stock_dates[stock_dates <= filing_ts]
        if len(before_dates) == 0:
            before_dates = stock_dates[:1]
        price_before = float(stock_hist.loc[before_dates[-1], "Close"])

        # Find price ~window_days after
        target_date = fd + timedelta(days=window_days)
        target_ts = target_date.replace(tzinfo=stock_dates[0].tzinfo) if stock_dates[0].tzinfo else target_date
        after_dates = stock_dates[stock_dates >= target_ts]
        if len(after_dates) == 0:
            after_dates = stock_dates[-1:]
        price_after = float(stock_hist.loc[after_dates[0], "Close"])

        # SPY return over same period
        spy_dates = spy_hist.index
        spy_before_dates = spy_dates[spy_dates <= filing_ts]
        if len(spy_before_dates) == 0:
            spy_before_dates = spy_dates[:1]
        spy_price_before = float(spy_hist.loc[spy_before_dates[-1], "Close"])

        spy_after_dates = spy_dates[spy_dates >= target_ts]
        if len(spy_after_dates) == 0:
            spy_after_dates = spy_dates[-1:]
        spy_price_after = float(spy_hist.loc[spy_after_dates[0], "Close"])

        abs_return = (price_after - price_before) / price_before * 100
        spy_return = (spy_price_after - spy_price_before) / spy_price_before * 100
        alpha = abs_return - spy_return

        return {
            "ticker": ticker.upper(),
            "filing_date": filing_date,
            "window_days": window_days,
            "price_before": round(price_before, 2),
            "price_after_30d": round(price_after, 2),
            "absolute_return_pct": round(abs_return, 2),
            "spy_return_pct": round(spy_return, 2),
            "alpha_vs_spy": round(alpha, 2),
            "data_available": True,
        }

    except Exception as exc:
        logger.error("Alpha check failed for %s: %s", ticker, exc)
        return {
            "ticker": ticker,
            "filing_date": filing_date,
            "data_available": False,
            "error": str(exc),
        }


def get_historical_divergence_reactions(
    ticker: str,
    filing_dates: list[str],
    window_days: int = 30,
) -> list[dict[str, Any]]:
    """Compute post-filing alpha for multiple filing dates."""
    results = []
    for fd in filing_dates:
        result = check_post_filing_alpha(ticker, fd, window_days)
        results.append(result)
    results.sort(key=lambda x: x.get("filing_date", ""), reverse=True)
    return results
