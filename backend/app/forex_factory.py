"""
Hedgyyyboo Phase 6 — Forex Factory Economic Calendar Parser.

Parses the live Forex Factory XML feed to extract high-impact
economic events with forecast vs actual deltas.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any

import requests
from lxml import etree

logger = logging.getLogger("hedgyyyboo.forex_factory")

FF_XML_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"

# Simple in-memory cache to avoid 429 rate limits
_ff_cache: dict[str, Any] = {"data": None, "fetched_at": 0.0}
_FF_CACHE_TTL = 300  # 5 minutes


def _parse_number(s: str | None) -> float | None:
    """Parse a numeric string like '3.5%' or '-0.2K' to float."""
    if not s or s.strip() == "":
        return None
    s = s.strip().replace("%", "").replace("K", "").replace("M", "").replace("B", "")
    try:
        return float(s)
    except ValueError:
        return None


def fetch_forex_factory_events() -> dict[str, Any]:
    """Fetch and parse the Forex Factory XML feed.

    Returns high-impact events with forecast/actual deltas.
    Uses in-memory cache to avoid 429 rate limits.
    """
    # Return cached data if fresh enough
    now = time.time()
    if _ff_cache["data"] is not None and (now - _ff_cache["fetched_at"]) < _FF_CACHE_TTL:
        logger.info("Forex Factory: returning cached data (age %.0fs)", now - _ff_cache["fetched_at"])
        return _ff_cache["data"]

    try:
        # Retry up to 3 times with backoff
        resp = None
        for attempt in range(3):
            try:
                resp = requests.get(
                    FF_XML_URL,
                    timeout=15,
                    headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) hedgyyyboo/6.1"},
                )
                if resp.status_code == 429:
                    wait = 2 ** (attempt + 1)
                    logger.warning("Forex Factory 429 rate limited, retrying in %ds (attempt %d/3)", wait, attempt + 1)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                break
            except requests.RequestException:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise

        if resp is None or resp.status_code == 429:
            # All retries exhausted — return cache if available
            if _ff_cache["data"] is not None:
                logger.warning("Forex Factory: all retries failed, returning stale cache")
                return _ff_cache["data"]
            raise requests.RequestException("429 Too Many Requests after 3 retries")

        root = etree.fromstring(resp.content)

        events: list[dict[str, Any]] = []
        high_impact_events: list[dict[str, Any]] = []

        for event_el in root.findall(".//event"):
            title = event_el.findtext("title", "").strip()
            country = event_el.findtext("country", "").strip()
            date_str = event_el.findtext("date", "").strip()
            time_str = event_el.findtext("time", "").strip()
            impact = event_el.findtext("impact", "").strip()
            forecast_str = event_el.findtext("forecast", "").strip()
            previous_str = event_el.findtext("previous", "").strip()
            actual_str = event_el.findtext("actual", "").strip()

            forecast = _parse_number(forecast_str)
            previous = _parse_number(previous_str)
            actual = _parse_number(actual_str)

            # Compute surprise delta
            surprise_delta = None
            surprise_direction = None
            if actual is not None and forecast is not None:
                surprise_delta = round(actual - forecast, 4)
                surprise_direction = "BEAT" if surprise_delta > 0 else "MISS" if surprise_delta < 0 else "INLINE"

            event_data = {
                "title": title,
                "country": country,
                "date": date_str,
                "time": time_str,
                "impact": impact.capitalize() if impact else "Low",
                "forecast": forecast_str or None,
                "previous": previous_str or None,
                "actual": actual_str or None,
                "forecast_num": forecast,
                "actual_num": actual,
                "previous_num": previous,
                "surprise_delta": surprise_delta,
                "surprise_direction": surprise_direction,
            }

            events.append(event_data)

            if impact and impact.lower() == "high":
                high_impact_events.append(event_data)

        # Sort by date/time (most recent first)
        # Events with actual data first (already released)
        released = [e for e in high_impact_events if e["actual"] is not None]
        upcoming = [e for e in high_impact_events if e["actual"] is None]

        logger.info(
            "Forex Factory: %d total events, %d high-impact (%d released, %d upcoming)",
            len(events), len(high_impact_events), len(released), len(upcoming),
        )

        result = {
            "status": "ok",
            "total_events": len(events),
            "high_impact_count": len(high_impact_events),
            "released_events": released,
            "upcoming_events": upcoming,
            "all_events": events[:50],  # Cap for API response size
            "fetched_at": datetime.now().isoformat(),
        }

        # Cache the successful result
        _ff_cache["data"] = result
        _ff_cache["fetched_at"] = time.time()

        return result

    except requests.RequestException as exc:
        logger.error("Forex Factory fetch failed: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
            "total_events": 0,
            "high_impact_count": 0,
            "released_events": [],
            "upcoming_events": [],
            "all_events": [],
        }
    except etree.XMLSyntaxError as exc:
        logger.error("Forex Factory XML parse failed: %s", exc)
        return {
            "status": "error",
            "message": f"XML parse error: {exc}",
            "total_events": 0,
            "high_impact_count": 0,
            "released_events": [],
            "upcoming_events": [],
            "all_events": [],
        }
