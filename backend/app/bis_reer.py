"""
Hedgyyyboo Phase 6 — BIS Real Effective Exchange Rate (REER) Engine.

The Bank for International Settlements publishes monthly REER indices
that show whether a currency is structurally overvalued or undervalued
relative to a basket of trade partners.

REER > 100 → Currency is overvalued vs historical average
REER < 100 → Currency is undervalued vs historical average

Source: BIS SDMX REST API (https://stats.bis.org/api/v2/)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import requests
import numpy as np

logger = logging.getLogger("hedgyyyboo.bis_reer")

# ---------------------------------------------------------------------------
# BIS SDMX API Configuration
# ---------------------------------------------------------------------------

BIS_API_BASE = "https://stats.bis.org/api/v2"

# BIS REER dataset: WS_EER (Effective Exchange Rate)
# Frequency: M (monthly), Measure: R (real), Basket: B (broad)
# Country codes (ISO alpha-2 area codes used by BIS):
REER_CURRENCIES = {
    "EUR": {"bis_code": "XM", "name": "Euro Area", "pair": "EUR/USD"},
    "JPY": {"bis_code": "JP", "name": "Japan", "pair": "USD/JPY"},
    "GBP": {"bis_code": "GB", "name": "United Kingdom", "pair": "GBP/USD"},
    "AUD": {"bis_code": "AU", "name": "Australia", "pair": "AUD/USD"},
    "CHF": {"bis_code": "CH", "name": "Switzerland", "pair": "USD/CHF"},
    "USD": {"bis_code": "US", "name": "United States", "pair": "DXY"},
    "INR": {"bis_code": "IN", "name": "India", "pair": "USD/INR"},
    "CAD": {"bis_code": "CA", "name": "Canada", "pair": "USD/CAD"},
}


def _fetch_bis_reer_series(country_code: str) -> list[dict[str, Any]]:
    """Fetch REER time series from BIS SDMX API for a given country.

    BIS SDMX 2.1 REST endpoint:
    /data/dataflow/BIS/WS_EER/1.0/{key}
    Key: M.{country}.R.B  (Monthly, Real, Broad basket)
    """
    # BIS SDMX REST URL format
    key = f"M.{country_code}.R.B"
    url = f"{BIS_API_BASE}/data/dataflow/BIS/WS_EER/1.0/{key}"

    headers = {"Accept": "application/vnd.sdmx.data+json;version=2.0.0"}

    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        # Parse SDMX JSON 2.0 response
        datasets = data.get("data", {}).get("dataSets", [])
        if not datasets:
            return []

        # Get time dimension
        dimensions = data.get("data", {}).get("structures", [{}])[0]
        obs_dim = dimensions.get("dimensions", {}).get("observation", [{}])
        time_values = []
        for dim in obs_dim:
            if dim.get("id") == "TIME_PERIOD":
                time_values = [v.get("id", "") for v in dim.get("values", [])]
                break

        # Extract observations
        series_data = datasets[0].get("series", {})
        observations = []

        for series_key, series_val in series_data.items():
            obs = series_val.get("observations", {})
            for time_idx_str, values in obs.items():
                time_idx = int(time_idx_str)
                if time_idx < len(time_values) and values:
                    observations.append({
                        "date": time_values[time_idx],
                        "reer_index": float(values[0]),
                    })

        # Sort by date descending
        observations.sort(key=lambda x: x["date"], reverse=True)
        return observations

    except Exception as exc:
        logger.warning("BIS REER fetch failed for %s: %s", country_code, exc)
        return []


def _compute_reer_valuation(
    observations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute valuation metrics from REER time series."""
    if not observations:
        return {"status": "no_data", "valuation": "UNKNOWN"}

    values = [obs["reer_index"] for obs in observations]
    latest = values[0]
    latest_date = observations[0]["date"]

    # Compute statistics
    mean_5y = float(np.mean(values[:60])) if len(values) >= 12 else float(np.mean(values))
    std_5y = float(np.std(values[:60])) if len(values) >= 12 else float(np.std(values))

    # Z-score vs 5-year average
    z_score = round((latest - mean_5y) / std_5y, 3) if std_5y > 0 else 0.0

    # Valuation assessment
    if z_score > 1.5:
        valuation = "SIGNIFICANTLY OVERVALUED"
    elif z_score > 0.75:
        valuation = "OVERVALUED"
    elif z_score > 0.25:
        valuation = "MILDLY OVERVALUED"
    elif z_score < -1.5:
        valuation = "SIGNIFICANTLY UNDERVALUED"
    elif z_score < -0.75:
        valuation = "UNDERVALUED"
    elif z_score < -0.25:
        valuation = "MILDLY UNDERVALUED"
    else:
        valuation = "FAIR VALUE"

    # YoY change
    yoy_change = 0.0
    if len(values) >= 12:
        yoy_change = round((latest / values[11] - 1) * 100, 2)

    # 6M change
    mom_6m = 0.0
    if len(values) >= 6:
        mom_6m = round((latest / values[5] - 1) * 100, 2)

    # Trend
    if len(values) >= 3:
        recent_trend = "APPRECIATING" if values[0] > values[2] else "DEPRECIATING" if values[0] < values[2] else "FLAT"
    else:
        recent_trend = "UNKNOWN"

    return {
        "status": "ok",
        "latest_reer": round(latest, 2),
        "latest_date": latest_date,
        "mean_5y": round(mean_5y, 2),
        "std_5y": round(std_5y, 2),
        "z_score": z_score,
        "valuation": valuation,
        "yoy_change_pct": yoy_change,
        "mom_6m_change_pct": mom_6m,
        "recent_trend": recent_trend,
        "history": [{"date": obs["date"], "reer": round(obs["reer_index"], 2)} for obs in observations[:24]],
    }


def fetch_bis_reer() -> dict[str, Any]:
    """Fetch BIS REER data for all tracked currencies."""
    results = []

    for ccy, info in REER_CURRENCIES.items():
        try:
            observations = _fetch_bis_reer_series(info["bis_code"])
            analysis = _compute_reer_valuation(observations)
            analysis["currency"] = ccy
            analysis["country"] = info["name"]
            analysis["fx_pair"] = info["pair"]
            results.append(analysis)

            if analysis["status"] == "ok":
                logger.info(
                    "BIS REER %s: index=%.1f z=%.2f → %s",
                    ccy, analysis["latest_reer"], analysis["z_score"], analysis["valuation"],
                )
        except Exception as exc:
            logger.warning("BIS REER analysis failed for %s: %s", ccy, exc)
            results.append({
                "currency": ccy,
                "country": info["name"],
                "fx_pair": info["pair"],
                "status": "error",
                "valuation": "UNKNOWN",
                "message": str(exc),
            })

    # Find most overvalued and undervalued
    ok_results = [r for r in results if r.get("status") == "ok"]
    most_overvalued = max(ok_results, key=lambda x: x.get("z_score", 0), default=None)
    most_undervalued = min(ok_results, key=lambda x: x.get("z_score", 0), default=None)

    return {
        "status": "ok",
        "source": "Bank for International Settlements (BIS)",
        "currencies": results,
        "count": len(results),
        "most_overvalued": most_overvalued.get("currency") if most_overvalued else None,
        "most_undervalued": most_undervalued.get("currency") if most_undervalued else None,
        "fetched_at": datetime.now().isoformat(),
    }
