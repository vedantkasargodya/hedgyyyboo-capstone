"""
Hedgyyyboo — Geopolitical event geo-tagging for the globe.

Fetches live geopolitical news and maps them to approximate coordinates
using keyword matching for countries/regions.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.news_feed import fetch_news

logger = logging.getLogger("hedgyyyboo.geo_events")

# Country/Region → (lat, lng) mapping for geo-tagging news
GEO_KEYWORDS: dict[str, tuple[float, float]] = {
    # Middle East
    "iran": (32.4279, 53.6880),
    "iraq": (33.2232, 43.6793),
    "israel": (31.0461, 34.8516),
    "gaza": (31.3547, 34.3088),
    "palestine": (31.9522, 35.2332),
    "syria": (34.8021, 38.9968),
    "yemen": (15.5527, 48.5164),
    "lebanon": (33.8547, 35.8623),
    "saudi": (23.8859, 45.0792),
    "saudi arabia": (23.8859, 45.0792),
    # Europe
    "ukraine": (48.3794, 31.1656),
    "russia": (61.5240, 105.3188),
    "kremlin": (55.7520, 37.6175),
    "moscow": (55.7558, 37.6173),
    "nato": (50.8770, 4.3227),
    "europe": (50.1109, 8.6821),
    "uk": (55.3781, -3.4360),
    "britain": (55.3781, -3.4360),
    "france": (46.2276, 2.2137),
    "germany": (51.1657, 10.4515),
    # Asia
    "china": (35.8617, 104.1954),
    "beijing": (39.9042, 116.4074),
    "taiwan": (23.6978, 120.9605),
    "north korea": (40.3399, 127.5101),
    "south korea": (35.9078, 127.7669),
    "japan": (36.2048, 138.2529),
    "india": (20.5937, 78.9629),
    "pakistan": (30.3753, 69.3451),
    "afghanistan": (33.9391, 67.7100),
    # Americas
    "united states": (39.8283, -98.5795),
    "us ": (39.8283, -98.5795),
    "washington": (38.9072, -77.0369),
    "pentagon": (38.8719, -77.0563),
    "mexico": (23.6345, -102.5528),
    "brazil": (-14.2350, -51.9253),
    "venezuela": (6.4238, -66.5897),
    # Africa
    "sudan": (12.8628, 30.2176),
    "libya": (26.3351, 17.2283),
    "nigeria": (9.0820, 8.6753),
    "south africa": (-30.5595, 22.9375),
    "ethiopia": (9.1450, 40.4897),
    # Energy/Commodity locations
    "opec": (23.8859, 45.0792),
    "strait of hormuz": (26.5944, 56.2708),
    "suez canal": (30.4580, 32.3499),
    "red sea": (20.2808, 38.5126),
}

# Event type classification
EVENT_TYPES = {
    "conflict": ["war", "attack", "strike", "missile", "bomb", "military", "invasion", "combat", "battle", "troops"],
    "sanctions": ["sanction", "embargo", "tariff", "trade war", "ban", "restrict"],
    "diplomacy": ["summit", "treaty", "agreement", "negotiate", "talks", "diplomacy", "peace"],
    "energy": ["oil", "gas", "opec", "pipeline", "energy crisis", "crude"],
    "crisis": ["crisis", "emergency", "collapse", "coup", "protest", "unrest"],
}


def _classify_event(title: str) -> str:
    """Classify a news headline into an event type."""
    title_lower = title.lower()
    for event_type, keywords in EVENT_TYPES.items():
        for kw in keywords:
            if kw in title_lower:
                return event_type
    return "general"


def _geo_tag(title: str) -> list[dict[str, Any]]:
    """Extract geographic coordinates from a headline."""
    title_lower = title.lower()
    locations = []
    for keyword, (lat, lng) in GEO_KEYWORDS.items():
        if keyword in title_lower:
            locations.append({"keyword": keyword, "lat": lat, "lng": lng})
    return locations


def get_geo_events(limit: int = 30) -> list[dict[str, Any]]:
    """Fetch geopolitical news and geo-tag them for globe plotting."""
    # Fetch from geopolitical + macro + energy categories
    all_items = []
    all_items.extend(fetch_news(category="geopolitical", limit=20))
    all_items.extend(fetch_news(category="macro", limit=15))
    all_items.extend(fetch_news(category="energy", limit=10))

    events = []
    seen_titles: set[str] = set()

    for item in all_items:
        title = item.get("title", "")
        if not title or title.lower()[:50] in seen_titles:
            continue
        seen_titles.add(title.lower()[:50])

        locations = _geo_tag(title)
        if not locations:
            continue

        event_type = _classify_event(title)

        for loc in locations[:1]:  # One pin per headline
            events.append({
                "title": title,
                "source": item.get("source", ""),
                "published": item.get("published", ""),
                "category": item.get("category", ""),
                "event_type": event_type,
                "lat": loc["lat"],
                "lng": loc["lng"],
                "region": loc["keyword"],
            })

    # Deduplicate by location proximity
    return events[:limit]
