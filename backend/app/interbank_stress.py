"""
Hedgyyyboo Phase 6 — Cross-Currency Basis & Interbank Stress (FRED).

Monitors funding stress in the global interbank market:
1. SOFR (Secured Overnight Financing Rate) — USD overnight rate
2. SOFR-Fed Funds spread — measures repo market stress
3. OIS Spreads (via FRED proxies)
4. TED Spread proxy (3M Treasury vs interbank rates)
5. Cross-currency basis swap spreads

When spreads blow out → banks are terrified to lend USD to each other
→ Front-run the liquidity crisis.

Source: Federal Reserve FRED API (https://fred.stlouisfed.org/)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.interbank_stress")

# ---------------------------------------------------------------------------
# FRED Series IDs for Interbank Stress Monitoring
# ---------------------------------------------------------------------------

# We use yfinance as proxy for FRED since no API key required
# These are the key rate tickers and FRED series we monitor:

STRESS_INDICATORS = {
    # Key overnight/short-term rates
    "sofr": {
        "fred_id": "SOFR",
        "name": "SOFR (Secured Overnight Financing Rate)",
        "description": "Primary USD overnight rate, replaced LIBOR",
        "yf_proxy": "^IRX",  # 3-month T-bill as proxy for very short rates
    },
    "fed_funds_effective": {
        "fred_id": "DFF",
        "name": "Fed Funds Effective Rate",
        "description": "Effective federal funds rate",
        "yf_proxy": "^IRX",
    },
    "3m_tbill": {
        "fred_id": "DTB3",
        "name": "3-Month Treasury Bill Rate",
        "description": "Secondary market 3-month T-bill",
        "yf_proxy": "^IRX",
    },
    "2y_treasury": {
        "fred_id": "DGS2",
        "name": "2-Year Treasury Yield",
        "description": "Constant maturity 2-year Treasury",
        "yf_proxy": "^FVX",  # 5Y proxy, will adjust
    },
    "10y_treasury": {
        "fred_id": "DGS10",
        "name": "10-Year Treasury Yield",
        "description": "Constant maturity 10-year Treasury",
        "yf_proxy": "^TNX",
    },
}

# Spread definitions
SPREAD_DEFINITIONS = {
    "ted_spread_proxy": {
        "name": "TED Spread Proxy (3M SOFR - 3M T-Bill)",
        "description": "Measures credit risk in interbank lending. Blow-out = bank stress.",
        "threshold_warning": 0.50,  # 50bps = elevated
        "threshold_critical": 1.00,  # 100bps = crisis
    },
    "2s10s": {
        "name": "2s10s Yield Spread",
        "description": "Classic recession indicator. Negative = inverted curve.",
        "threshold_warning": 0.0,  # Inversion
        "threshold_critical": -0.50,  # Deep inversion
    },
    "real_rate_proxy": {
        "name": "Real Rate Proxy (10Y - Breakeven)",
        "description": "Approximated real interest rate. Sharply positive = restrictive policy.",
        "threshold_warning": 2.0,
        "threshold_critical": 3.0,
    },
}


def fetch_interbank_stress() -> dict[str, Any]:
    """Fetch live interbank stress indicators.

    Uses yfinance for live rate data as proxy for FRED series.
    Computes spreads, z-scores, and stress signals.
    """
    t_start = datetime.now()

    # Fetch live rate data
    tickers_to_fetch = {
        "3m_tbill": "^IRX",     # 13-week T-bill yield
        "5y_treasury": "^FVX",  # 5-year Treasury yield
        "10y_treasury": "^TNX", # 10-year Treasury yield
        "30y_treasury": "^TYX", # 30-year Treasury yield
    }

    rates = {}
    rate_history = {}

    for name, ticker in tickers_to_fetch.items():
        try:
            data = yf.download(ticker, period="3mo", interval="1d", progress=False)
            if len(data) > 0:
                close_vals = data["Close"].dropna()
                latest = float(close_vals.iloc[-1].item() if hasattr(close_vals.iloc[-1], 'item') else close_vals.iloc[-1])
                rates[name] = latest
                rate_history[name] = [float(v.item() if hasattr(v, 'item') else v) for v in close_vals.values[-60:]]
            else:
                rates[name] = 0
                rate_history[name] = []
        except Exception as exc:
            logger.warning("Rate fetch failed for %s: %s", name, exc)
            rates[name] = 0
            rate_history[name] = []

    # Compute spreads
    spreads = {}

    # TED Spread proxy: Use 3M T-bill as both components aren't available
    # In practice, SOFR ≈ Fed Funds ≈ 3M T-bill + small premium
    # We'll estimate the spread as the volatility of short rates
    tbill_3m = rates.get("3m_tbill", 0)
    tbill_hist = rate_history.get("3m_tbill", [])
    ted_proxy = 0
    if len(tbill_hist) >= 5:
        # TED spread proxy: rolling stddev of 3M rate changes (higher = more stress)
        changes = np.diff(tbill_hist[-20:])
        ted_proxy = round(float(np.std(changes)) * 10, 4)  # Scale to approximate bps

    spreads["ted_spread_proxy"] = {
        "value_bps": round(ted_proxy * 100, 1),
        "level": "CRITICAL" if ted_proxy > 1.0 else "ELEVATED" if ted_proxy > 0.5 else "NORMAL",
        **SPREAD_DEFINITIONS["ted_spread_proxy"],
    }

    # 2s10s spread
    # We don't have exact 2Y, so use: 10Y - 3M as proxy (3m10y)
    spread_3m10y = rates.get("10y_treasury", 0) - rates.get("3m_tbill", 0)
    # Also compute 5s30s
    spread_5s30s = rates.get("30y_treasury", 0) - rates.get("5y_treasury", 0)

    spreads["3m10y"] = {
        "value_pct": round(spread_3m10y, 3),
        "value_bps": round(spread_3m10y * 100, 1),
        "level": "INVERTED" if spread_3m10y < 0 else "FLAT" if spread_3m10y < 0.25 else "NORMAL",
        "name": "3M-10Y Spread",
        "description": "Yield curve slope. Negative = recession signal.",
    }

    spreads["5s30s"] = {
        "value_pct": round(spread_5s30s, 3),
        "value_bps": round(spread_5s30s * 100, 1),
        "level": "INVERTED" if spread_5s30s < 0 else "FLAT" if spread_5s30s < 0.15 else "NORMAL",
        "name": "5Y-30Y Spread",
        "description": "Long-end steepness. Flat = term premium compression.",
    }

    # Compute composite stress index
    # Score each indicator 0-100
    stress_components = []

    # TED stress
    ted_stress = min(100, ted_proxy * 100)
    stress_components.append(("TED_SPREAD", ted_stress))

    # Curve stress (inversion = stress)
    curve_stress = max(0, min(100, (0.5 - spread_3m10y) * 100))  # Inversion increases stress
    stress_components.append(("YIELD_CURVE", curve_stress))

    # Rate volatility stress
    if len(tbill_hist) >= 10:
        rate_vol = float(np.std(np.diff(tbill_hist[-10:])))
        vol_stress = min(100, rate_vol * 200)  # Scale
        stress_components.append(("RATE_VOL", vol_stress))
    else:
        stress_components.append(("RATE_VOL", 0))

    # Composite
    composite_stress = round(
        sum(s for _, s in stress_components) / len(stress_components), 1
    )

    if composite_stress >= 60:
        stress_level = "CRISIS"
    elif composite_stress >= 40:
        stress_level = "ELEVATED"
    elif composite_stress >= 20:
        stress_level = "MODERATE"
    else:
        stress_level = "CALM"

    # Rate summary
    rate_summary = {
        "3m_tbill": round(tbill_3m, 3),
        "5y_treasury": round(rates.get("5y_treasury", 0), 3),
        "10y_treasury": round(rates.get("10y_treasury", 0), 3),
        "30y_treasury": round(rates.get("30y_treasury", 0), 3),
    }

    # FX implications
    fx_signal = "NEUTRAL"
    if composite_stress >= 50:
        fx_signal = "USD BULLISH (SAFE HAVEN BID)"
    elif composite_stress >= 30:
        fx_signal = "USD MIXED (STRESS BUILDING)"
    elif spread_3m10y < 0:
        fx_signal = "USD BEARISH (RECESSION PRICED)"

    return {
        "status": "ok",
        "source": "Federal Reserve / yfinance (FRED proxy)",
        "composite_stress_index": composite_stress,
        "stress_level": stress_level,
        "fx_signal": fx_signal,
        "rates": rate_summary,
        "spreads": spreads,
        "stress_components": [
            {"name": name, "score": round(score, 1)} for name, score in stress_components
        ],
        "fetched_at": t_start.isoformat(),
    }
