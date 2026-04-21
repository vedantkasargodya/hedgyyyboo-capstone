"""
Hedgyyyboo Phase 3 — DCC-GARCH Tail Risk Engine.

Fetches 2 years of live daily returns for 5 global equity indices,
fits GARCH(1,1) conditional volatility models via the ``arch`` library,
computes a 60-day rolling correlation matrix, and identifies the
strongest cross-market contagion links.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import yfinance as yf
from arch import arch_model

logger = logging.getLogger("hedgyyyboo.garch_engine")

# Global index universe
INDICES: list[dict[str, str]] = [
    {"name": "S&P 500 (US)", "symbol": "SPY"},
    {"name": "BSE Sensex (India)", "symbol": "^BSESN"},
    {"name": "FTSE 100 (UK)", "symbol": "^FTSE"},
    {"name": "Nikkei 225 (Japan)", "symbol": "^N225"},
    {"name": "China Large-Cap (China)", "symbol": "FXI"},
]

ROLLING_WINDOW = 60  # days for rolling correlation


def _fetch_returns(symbol: str, period_years: int = 2) -> pd.Series:
    """Download daily close prices and compute log returns."""
    end = datetime.now(tz=timezone.utc)
    start = end - timedelta(days=period_years * 365)

    ticker = yf.Ticker(symbol)
    hist = ticker.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))

    if hist.empty or len(hist) < ROLLING_WINDOW + 10:
        raise ValueError(f"Insufficient price history for {symbol} ({len(hist)} rows)")

    closes = hist["Close"].dropna()
    returns = np.log(closes / closes.shift(1)).dropna() * 100  # percentage log returns
    returns.name = symbol
    return returns


def _fit_garch(returns: pd.Series) -> dict:
    """Fit a GARCH(1,1) model and return conditional vol metrics."""
    am = arch_model(returns, vol="Garch", p=1, q=1, dist="Normal", rescale=False)
    res = am.fit(disp="off", show_warning=False)
    cond_vol = res.conditional_volatility

    current_vol = float(cond_vol.iloc[-1])
    vol_1w_ago = float(cond_vol.iloc[-5]) if len(cond_vol) >= 5 else current_vol
    vol_change_1w = round(((current_vol - vol_1w_ago) / vol_1w_ago) * 100, 2) if vol_1w_ago != 0 else 0.0

    return {
        "current_vol": round(current_vol, 4),
        "vol_change_1w": vol_change_1w,
        "conditional_vol": round(float(cond_vol.iloc[-1]), 4),
        "annualised_vol": round(current_vol * np.sqrt(252) / 100, 4),
        "garch_params": {
            "omega": round(float(res.params.get("omega", 0)), 6),
            "alpha": round(float(res.params.get("alpha[1]", 0)), 6),
            "beta": round(float(res.params.get("beta[1]", 0)), 6),
        },
    }


async def get_tail_risk() -> dict:
    """Run the full DCC-GARCH tail risk pipeline on 5 global indices.

    Returns
    -------
    dict with keys:
        markets            – per-index vol stats from GARCH(1,1)
        correlation_matrix – 5x5 rolling correlation (60-day window)
        contagion_links    – top correlated pairs ranked by strength
        risk_summary       – human-readable summary string
    """
    try:
        # ------------------------------------------------------------------
        # 1. Fetch returns for all indices
        # ------------------------------------------------------------------
        returns_map: dict[str, pd.Series] = {}
        markets: list[dict] = []

        for idx in INDICES:
            symbol = idx["symbol"]
            name = idx["name"]
            try:
                rets = _fetch_returns(symbol)
                returns_map[symbol] = rets
                garch_out = _fit_garch(rets)
                markets.append({
                    "name": name,
                    "symbol": symbol,
                    **garch_out,
                })
                logger.info("GARCH fitted for %s — cond vol %.4f", symbol, garch_out["current_vol"])
            except Exception as exc:
                logger.warning("Failed to process %s (%s): %s", name, symbol, exc)
                markets.append({
                    "name": name,
                    "symbol": symbol,
                    "current_vol": None,
                    "vol_change_1w": None,
                    "conditional_vol": None,
                    "annualised_vol": None,
                    "garch_params": None,
                    "error": str(exc),
                })

        # ------------------------------------------------------------------
        # 2. Rolling correlation matrix (60-day)
        # ------------------------------------------------------------------
        # Align all return series on a common date index
        valid_symbols = [s for s in returns_map]
        if len(valid_symbols) < 2:
            raise ValueError("Need at least 2 valid index return series for correlation")

        returns_df = pd.DataFrame(returns_map).ffill().dropna()

        if len(returns_df) < ROLLING_WINDOW:
            raise ValueError(
                f"Only {len(returns_df)} overlapping observations; "
                f"need at least {ROLLING_WINDOW} for rolling correlation"
            )

        # Use most recent 60-day window for the correlation snapshot
        recent = returns_df.tail(ROLLING_WINDOW)
        corr_matrix = recent.corr()

        labels = [idx["name"] for idx in INDICES if idx["symbol"] in corr_matrix.columns]
        corr_values = []
        for sym_row in corr_matrix.columns:
            row_vals = []
            for sym_col in corr_matrix.columns:
                row_vals.append(round(float(corr_matrix.loc[sym_row, sym_col]), 4))
            corr_values.append(row_vals)

        # ------------------------------------------------------------------
        # 3. Contagion links — top pairs by absolute correlation
        # ------------------------------------------------------------------
        contagion_links: list[dict] = []
        symbols_list = list(corr_matrix.columns)
        name_lookup = {idx["symbol"]: idx["name"] for idx in INDICES}

        for i in range(len(symbols_list)):
            for j in range(i + 1, len(symbols_list)):
                sym_i, sym_j = symbols_list[i], symbols_list[j]
                corr_val = float(corr_matrix.loc[sym_i, sym_j])
                abs_corr = abs(corr_val)
                strength = "high" if abs_corr >= 0.7 else ("medium" if abs_corr >= 0.4 else "low")
                contagion_links.append({
                    "source": name_lookup.get(sym_i, sym_i),
                    "target": name_lookup.get(sym_j, sym_j),
                    "correlation": round(corr_val, 4),
                    "strength": strength,
                })

        # Sort by absolute correlation descending
        contagion_links.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        # ------------------------------------------------------------------
        # 4. Risk summary
        # ------------------------------------------------------------------
        high_vol_markets = [m["name"] for m in markets if m.get("current_vol") and m["current_vol"] > 1.5]
        rising_vol = [m["name"] for m in markets if m.get("vol_change_1w") and m["vol_change_1w"] > 5]
        high_corr_pairs = [
            f"{l['source']}<->{l['target']} ({l['correlation']:.2f})"
            for l in contagion_links[:3]
            if l["strength"] == "high"
        ]

        summary_parts = []
        if high_vol_markets:
            summary_parts.append(f"Elevated conditional volatility in: {', '.join(high_vol_markets)}.")
        if rising_vol:
            summary_parts.append(f"Rising vol (>5% week-over-week): {', '.join(rising_vol)}.")
        if high_corr_pairs:
            summary_parts.append(f"Strongest contagion links: {'; '.join(high_corr_pairs)}.")
        if not summary_parts:
            summary_parts.append("Global cross-market volatility is within normal ranges.")

        risk_summary = " ".join(summary_parts)
        logger.info("Tail risk summary: %s", risk_summary)

        return {
            "markets": markets,
            "correlation_matrix": {
                "labels": labels,
                "values": corr_values,
            },
            "contagion_links": contagion_links,
            "risk_summary": risk_summary,
        }

    except ValueError:
        raise
    except Exception as exc:
        logger.exception("Tail risk engine failed")
        raise RuntimeError(f"Tail risk engine failed: {exc}") from exc
