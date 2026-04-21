"""
Hedgyyyboo Phase 6 — GDELT Geopolitical Stress Index.

The GDELT Project (Global Database of Events, Language, and Tone)
monitors global news in real-time, scoring:
- Event tone (positive/negative)
- Goldstein scale (-10 to +10, conflict to cooperation)
- Number of events, mentions, sources

We compute a live Geopolitical Stress Index for country pairs
relevant to FX trading (US-China, US-EU, US-Japan, etc.).

Source: GDELT 2.0 Analysis Service (https://api.gdeltproject.org/)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import time as _time

import requests
import numpy as np

logger = logging.getLogger("hedgyyyboo.gdelt_geo")

# In-memory cache.  TTL is intentionally long because GDELT rate-limits
# aggressively and the payload doesn't meaningfully change faster than
# every ~30 minutes anyway.  A background pre-warm fills the cache on
# startup so the first UI load is instant.
_gdelt_cache: dict[str, Any] = {"data": None, "fetched_at": 0.0}
_GDELT_CACHE_TTL = 1800       # 30 minutes
_GDELT_REFRESHING = False     # simple single-flight lock

# ---------------------------------------------------------------------------
# GDELT Configuration
# ---------------------------------------------------------------------------

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GEO_API = "https://api.gdeltproject.org/api/v2/geo/geo"

# Country pairs to monitor for geopolitical stress
GEOPOLITICAL_PAIRS = [
    {
        "label": "US-CHINA",
        "query": "US China trade tariff sanctions",
        "fx_impact": ["USD/CNH", "AUD/USD"],
        "description": "US-China geopolitical tension (trade war, tech decoupling)",
    },
    {
        "label": "US-EU",
        "query": "United States Europe NATO trade",
        "fx_impact": ["EUR/USD"],
        "description": "US-EU relations (trade, NATO, regulatory divergence)",
    },
    {
        "label": "US-JAPAN",
        "query": "United States Japan yen intervention BOJ",
        "fx_impact": ["USD/JPY"],
        "description": "US-Japan monetary policy divergence",
    },
    {
        "label": "US-RUSSIA",
        "query": "Russia Ukraine sanctions energy",
        "fx_impact": ["EUR/USD", "USD/CHF"],
        "description": "Russia-Ukraine conflict & energy security",
    },
    {
        "label": "MIDDLE-EAST",
        "query": "Middle East Iran Israel oil conflict",
        "fx_impact": ["USD/CHF", "GBP/USD"],
        "description": "Middle East geopolitical risk & oil supply",
    },
    {
        "label": "INDIA",
        "query": "India economy RBI rupee Modi",
        "fx_impact": ["USD/INR"],
        "description": "India domestic policy & RBI actions",
    },
]


def _fetch_gdelt_tone(query: str, timespan: str = "24h") -> dict[str, Any]:
    """Fetch GDELT tone analysis for a query.

    Uses GDELT DOC 2.0 API to get:
    - Average tone of global news coverage
    - Volume of coverage (articles)
    - Themes detected

    Timespan: 24h, 7d, 3m
    """
    params = {
        "query": query,
        "mode": "ToneChart",
        "format": "json",
        "timespan": timespan,
    }

    try:
        resp = requests.get(GDELT_DOC_API, params=params, timeout=15)

        # Detect 429 rate limiting
        if resp.status_code == 429:
            logger.warning("GDELT 429 rate limited for '%s'", query)
            return {"tone": None, "articles": 0, "data_points": 0, "rate_limited": True}

        resp.raise_for_status()
        data = resp.json()

        if not data or not isinstance(data, list):
            return {"tone": None, "articles": 0, "data_points": []}

        # Parse tone data - GDELT returns array of {date, value} objects
        tones = []
        articles = 0
        for entry in data:
            if isinstance(entry, dict):
                tone_val = entry.get("value", entry.get("tone", 0))
                if tone_val is not None:
                    tones.append(float(tone_val))
                articles += int(entry.get("count", entry.get("articles", 1)))

        avg_tone = float(np.mean(tones)) if tones else None
        return {
            "tone": round(avg_tone, 3) if avg_tone is not None else None,
            "articles": articles,
            "data_points": len(tones),
        }

    except Exception as exc:
        logger.warning("GDELT tone fetch failed for '%s': %s", query, exc)
        return {"tone": None, "articles": 0, "data_points": 0, "error": str(exc)}


def _fetch_gdelt_volume(query: str) -> dict[str, Any]:
    """Fetch article volume timeline from GDELT."""
    params = {
        "query": query,
        "mode": "TimelineVol",
        "format": "json",
        "timespan": "7d",
    }

    try:
        resp = requests.get(GDELT_DOC_API, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if not data:
            return {"volume_trend": "UNKNOWN", "total_articles": 0}

        # Parse volume timeline
        volumes = []
        if isinstance(data, dict) and "timeline" in data:
            for series in data["timeline"]:
                for point in series.get("data", []):
                    volumes.append(int(point.get("value", 0)))
        elif isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict):
                    volumes.append(int(entry.get("value", entry.get("count", 0))))

        if not volumes:
            return {"volume_trend": "UNKNOWN", "total_articles": 0}

        total = sum(volumes)
        # Compare recent vs earlier for trend
        mid = len(volumes) // 2
        if mid > 0:
            recent = sum(volumes[mid:])
            earlier = sum(volumes[:mid])
            if recent > earlier * 1.3:
                trend = "SURGING"
            elif recent > earlier * 1.1:
                trend = "RISING"
            elif recent < earlier * 0.7:
                trend = "DECLINING"
            else:
                trend = "STABLE"
        else:
            trend = "UNKNOWN"

        return {
            "volume_trend": trend,
            "total_articles": total,
            "recent_volume": volumes[-1] if volumes else 0,
        }

    except Exception as exc:
        logger.warning("GDELT volume fetch failed for '%s': %s", query, exc)
        return {"volume_trend": "UNKNOWN", "total_articles": 0, "error": str(exc)}


def compute_geopolitical_stress_index() -> dict[str, Any]:
    """Compute live geopolitical stress index from GDELT data.

    The stress index combines:
    1. News tone (negative = stress)
    2. Article volume (high volume = attention/stress)
    3. Tone trend (worsening = rising stress)

    Index: 0 (calm) to 100 (extreme stress)
    """
    # Return cached data if fresh enough.  Also serve stale cached data
    # immediately if we have any — GDELT can take 60-90 s on a cold call
    # and the UI shouldn't block on it.  Caller may trigger
    # refresh_gdelt_in_background() after receiving stale data.
    global _GDELT_REFRESHING
    now = _time.time()
    age = now - _gdelt_cache["fetched_at"]
    if _gdelt_cache["data"] is not None and age < _GDELT_CACHE_TTL:
        logger.info("GDELT: returning cached data (age %.0fs)", age)
        return _gdelt_cache["data"]

    # Single-flight: only one caller computes; others get stale-with-note.
    if _GDELT_REFRESHING and _gdelt_cache["data"] is not None:
        logger.info("GDELT: refresh already in flight — serving stale (age %.0fs)", age)
        out = dict(_gdelt_cache["data"])
        out["_stale"] = True
        return out
    _GDELT_REFRESHING = True

    results = []
    total_stress = 0

    for idx, geo_pair in enumerate(GEOPOLITICAL_PAIRS):
        try:
            # Rate-limit: GDELT has aggressive throttling
            if idx > 0:
                _time.sleep(1.5)

            # Fetch tone (skip volume to halve request count)
            tone_data = _fetch_gdelt_tone(geo_pair["query"], "7d")
            volume_data = {"volume_trend": "UNKNOWN", "total_articles": 0}

            # Compute stress score (0-100)
            # Negative tone = higher stress. GDELT tone ranges roughly -10 to +10
            tone = tone_data.get("tone")
            articles = tone_data.get("articles", 0)
            rate_limited = tone_data.get("rate_limited", False)

            # If rate-limited or no tone data, mark as unknown
            if tone is None or rate_limited:
                logger.warning("GDELT %s: no tone data (rate_limited=%s), skipping", geo_pair["label"], rate_limited)
                results.append({
                    "label": geo_pair["label"],
                    "description": geo_pair["description"],
                    "fx_impact": geo_pair["fx_impact"],
                    "stress_score": 0,
                    "stress_level": "NO DATA",
                    "tone": 0,
                    "article_count": 0,
                    "volume_trend": "UNKNOWN",
                    "rate_limited": True,
                })
                continue

            # Tone component: map [-10, +10] to [100, 0]
            tone_stress = max(0, min(100, (5 - tone) * 10))

            # Volume component: normalize by expected baseline
            vol_stress = min(100, articles / 10)  # Rough scaling

            # Combined: 60% tone, 40% volume
            stress_score = round(tone_stress * 0.6 + vol_stress * 0.4, 1)

            # Stress level label
            if stress_score >= 70:
                level = "CRITICAL"
            elif stress_score >= 50:
                level = "ELEVATED"
            elif stress_score >= 30:
                level = "MODERATE"
            else:
                level = "LOW"

            result = {
                "label": geo_pair["label"],
                "description": geo_pair["description"],
                "fx_impact": geo_pair["fx_impact"],
                "stress_score": stress_score,
                "stress_level": level,
                "tone": round(tone, 3),
                "article_count": articles,
                "volume_trend": volume_data.get("volume_trend", "UNKNOWN"),
            }
            results.append(result)
            total_stress += stress_score

            logger.info(
                "GDELT %s: tone=%.2f articles=%d stress=%.1f (%s)",
                geo_pair["label"], tone, articles, stress_score, level,
            )

        except Exception as exc:
            logger.warning("GDELT analysis failed for %s: %s", geo_pair["label"], exc)
            results.append({
                "label": geo_pair["label"],
                "description": geo_pair["description"],
                "fx_impact": geo_pair["fx_impact"],
                "stress_score": 0,
                "stress_level": "UNKNOWN",
                "error": str(exc),
            })

    # Global stress index (average of pairs with valid data only)
    valid_regions = [r for r in results if not r.get("rate_limited") and r.get("stress_level") not in ("UNKNOWN", "NO DATA")]
    valid_count = len(valid_regions)
    if valid_count > 0:
        avg_stress = round(sum(r["stress_score"] for r in valid_regions) / valid_count, 1)
    else:
        avg_stress = 0

    if avg_stress >= 60:
        global_level = "RISK-OFF"
    elif avg_stress >= 40:
        global_level = "CAUTIOUS"
    elif avg_stress >= 20:
        global_level = "NEUTRAL"
    else:
        global_level = "RISK-ON"

    # Find hotspot
    hotspot = max(results, key=lambda x: x.get("stress_score", 0), default=None)

    output = {
        "status": "ok",
        "source": "GDELT Project (Global Database of Events, Language, Tone)",
        "global_stress_index": avg_stress,
        "global_level": global_level,
        "hotspot": hotspot.get("label") if hotspot else None,
        "hotspot_score": hotspot.get("stress_score") if hotspot else 0,
        "regions": results,
        "region_count": len(results),
        "valid_region_count": valid_count,
        "fetched_at": datetime.now().isoformat(),
    }

    # Cache successful results (only if we got at least some valid data)
    if valid_count > 0:
        _gdelt_cache["data"] = output
        _gdelt_cache["fetched_at"] = _time.time()

    global _GDELT_REFRESHING
    _GDELT_REFRESHING = False
    return output


def prewarm_gdelt_background() -> None:
    """Kick a background thread to populate the cache at startup so the
    first FX-desk load doesn't pay the 60-90s GDELT round-trip."""
    import threading
    def _run():
        try:
            logger.info("GDELT: pre-warming cache in background...")
            compute_geopolitical_stress_index()
            logger.info("GDELT: pre-warm complete.")
        except Exception as exc:
            logger.warning("GDELT pre-warm failed: %s", exc)
            global _GDELT_REFRESHING
            _GDELT_REFRESHING = False
    t = threading.Thread(target=_run, daemon=True)
    t.start()
