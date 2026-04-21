"""
Hedgyyyboo Phase 3 — Live 3D Implied Volatility Surface.

Pulls live options chain data from yfinance for a given ticker,
extracts strike / time-to-maturity / implied-volatility, and returns
a matrix suitable for 3D surface rendering on the frontend.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import numpy as np
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.vol_surface")


async def get_vol_surface(ticker: str = "SPY") -> dict:
    """Build a 3-D implied-volatility surface from live options data.

    Returns
    -------
    dict with keys:
        strikes       – sorted unique strike prices used
        maturities    – time-to-maturity in years for each expiry
        iv_matrix     – 2-D list  [maturity_idx][strike_idx] of IV values
        spot_price    – current underlying price
        skew_analysis – { put_iv_avg, call_iv_avg, skew_ratio }
        expiry_dates  – the raw expiration date strings used
        ticker        – echo of the requested ticker
    """
    try:
        yf_ticker = yf.Ticker(ticker)

        # ------------------------------------------------------------------
        # Spot price
        # ------------------------------------------------------------------
        hist = yf_ticker.history(period="1d")
        if hist.empty:
            raise ValueError(f"No price data returned for {ticker}")
        spot_price = float(hist["Close"].iloc[-1])
        logger.info("%s spot price: %.2f", ticker, spot_price)

        # ------------------------------------------------------------------
        # Expiration dates — take the next 4
        # ------------------------------------------------------------------
        all_expiries: tuple[str, ...] = yf_ticker.options
        if not all_expiries:
            raise ValueError(f"No options expirations found for {ticker}")

        expiries = list(all_expiries[:4])
        logger.info("%s using expiries: %s", ticker, expiries)

        # ------------------------------------------------------------------
        # Strike filter bounds: spot +/- 20 %
        # ------------------------------------------------------------------
        strike_lo = spot_price * 0.80
        strike_hi = spot_price * 1.20

        today = datetime.now(tz=timezone.utc).date()

        all_put_ivs: list[float] = []
        all_call_ivs: list[float] = []

        # Collect per-expiry rows: (maturity_years, strike, iv)
        raw_rows: list[tuple[float, float, float]] = []
        maturities_used: list[float] = []

        for expiry_str in expiries:
            expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
            dte = (expiry_date - today).days
            if dte <= 0:
                continue
            maturity = dte / 365.0

            try:
                chain = yf_ticker.option_chain(expiry_str)
            except Exception as exc:
                logger.warning("Skipping expiry %s: %s", expiry_str, exc)
                continue

            calls = chain.calls
            puts = chain.puts

            # --- Calls ---
            for _, row in calls.iterrows():
                strike = float(row["strike"])
                iv = row.get("impliedVolatility")
                if iv is None or np.isnan(iv) or iv <= 0:
                    continue
                if strike_lo <= strike <= strike_hi:
                    raw_rows.append((maturity, strike, float(iv)))
                    all_call_ivs.append(float(iv))

            # --- Puts ---
            for _, row in puts.iterrows():
                strike = float(row["strike"])
                iv = row.get("impliedVolatility")
                if iv is None or np.isnan(iv) or iv <= 0:
                    continue
                if strike_lo <= strike <= strike_hi:
                    raw_rows.append((maturity, strike, float(iv)))
                    all_put_ivs.append(float(iv))

            maturities_used.append(maturity)

        if not raw_rows:
            raise ValueError(
                f"No valid IV data after filtering for {ticker}. "
                "Options chains may be empty or outside the strike window."
            )

        # ------------------------------------------------------------------
        # Build the grid
        # ------------------------------------------------------------------
        strikes_set: set[float] = set()
        maturities_set: set[float] = set()
        iv_map: dict[tuple[float, float], list[float]] = {}

        for mat, strike, iv in raw_rows:
            strikes_set.add(strike)
            maturities_set.add(mat)
            iv_map.setdefault((mat, strike), []).append(iv)

        strikes_sorted = sorted(strikes_set)
        maturities_sorted = sorted(maturities_set)

        # Average IVs where calls & puts overlap at same (mat, strike)
        iv_matrix: list[list[float | None]] = []
        for mat in maturities_sorted:
            row: list[float | None] = []
            for strike in strikes_sorted:
                vals = iv_map.get((mat, strike))
                if vals:
                    row.append(round(float(np.mean(vals)), 6))
                else:
                    row.append(None)
            iv_matrix.append(row)

        # ------------------------------------------------------------------
        # Skew analysis
        # ------------------------------------------------------------------
        put_iv_avg = round(float(np.mean(all_put_ivs)), 6) if all_put_ivs else 0.0
        call_iv_avg = round(float(np.mean(all_call_ivs)), 6) if all_call_ivs else 0.0
        skew_ratio = round(put_iv_avg / call_iv_avg, 4) if call_iv_avg > 0 else 0.0

        logger.info(
            "%s vol surface built — %d strikes x %d maturities, skew %.4f",
            ticker,
            len(strikes_sorted),
            len(maturities_sorted),
            skew_ratio,
        )

        return {
            "ticker": ticker.upper(),
            "spot_price": round(spot_price, 2),
            "strikes": [round(s, 2) for s in strikes_sorted],
            "maturities": [round(m, 6) for m in maturities_sorted],
            "iv_matrix": iv_matrix,
            "expiry_dates": expiries,
            "skew_analysis": {
                "put_iv_avg": put_iv_avg,
                "call_iv_avg": call_iv_avg,
                "skew_ratio": skew_ratio,
            },
        }

    except ValueError:
        raise
    except Exception as exc:
        logger.exception("Vol surface generation failed for %s", ticker)
        raise RuntimeError(f"Vol surface generation failed: {exc}") from exc
