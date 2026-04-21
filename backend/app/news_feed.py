"""
Hedgyyyboo -- Live news feed via RSS (no API key required).

Aggregates headlines from Google News RSS across market categories.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

import feedparser

logger = logging.getLogger(__name__)

RSS_FEEDS: dict[str, list[str]] = {
    "markets": [
        "https://news.google.com/rss/search?q=stock+market+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=S%26P+500+OR+Dow+Jones+OR+Nasdaq+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "macro": [
        "https://news.google.com/rss/search?q=federal+reserve+OR+inflation+OR+GDP+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=economy+central+bank+interest+rate+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "tech": [
        "https://news.google.com/rss/search?q=technology+stocks+earnings+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=AI+artificial+intelligence+tech+sector+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "crypto": [
        "https://news.google.com/rss/search?q=cryptocurrency+bitcoin+ethereum+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "energy": [
        "https://news.google.com/rss/search?q=oil+energy+commodities+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "geopolitical": [
        "https://news.google.com/rss/search?q=geopolitical+war+sanctions+conflict+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=trade+war+tariffs+global+tensions+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "forex": [
        "https://news.google.com/rss/search?q=forex+dollar+euro+yen+currency+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=USD+INR+EUR+USD+GBP+forex+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "commodities": [
        "https://news.google.com/rss/search?q=gold+silver+commodities+metals+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=crude+oil+natural+gas+commodity+prices+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "bonds": [
        "https://news.google.com/rss/search?q=treasury+yields+bonds+fixed+income+when:1d&hl=en-US&gl=US&ceid=US:en",
        "https://news.google.com/rss/search?q=bond+market+credit+spread+sovereign+debt+when:1d&hl=en-US&gl=US&ceid=US:en",
    ],
    "india": [
        "https://news.google.com/rss/search?q=Sensex+Nifty+NSE+BSE+India+market+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
        "https://news.google.com/rss/search?q=RBI+India+economy+rupee+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    ],
}

# Minimum title length to filter out junk (ticker symbols, author names)
_MIN_TITLE_LENGTH = 15


def _parse_feed(url: str, category: str) -> list[dict[str, Any]]:
    """Parse a single RSS feed into normalised dicts."""
    try:
        feed = feedparser.parse(url)
        items = []
        for entry in feed.entries:
            published = ""
            if hasattr(entry, "published"):
                published = entry.published
            elif hasattr(entry, "updated"):
                published = entry.updated

            source = ""
            if hasattr(entry, "source") and hasattr(entry.source, "title"):
                source = entry.source.title
            else:
                title_parts = entry.get("title", "").rsplit(" - ", 1)
                if len(title_parts) == 2:
                    source = title_parts[1].strip()

            clean_title = entry.get("title", "")
            if " - " in clean_title:
                clean_title = clean_title.rsplit(" - ", 1)[0].strip()

            # Skip junk entries: ticker symbols, short strings, author names
            if len(clean_title) < _MIN_TITLE_LENGTH:
                continue
            # Skip entries that look like ticker symbols (e.g. ".SPNY", "(SAN.MC)")
            if re.match(r'^[\.\(\)A-Z0-9]{1,12}$', clean_title.strip()):
                continue

            items.append({
                "title": clean_title,
                "link": entry.get("link", ""),
                "published": published,
                "source": source,
                "category": category,
                "summary": re.sub(r"<[^>]+>", "", entry.get("summary", ""))[:200],
            })
        return items
    except Exception as exc:
        logger.warning("Failed to parse feed %s: %s", url, exc)
        return []


def _deduplicate(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate headlines by title similarity."""
    seen_titles: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        normalised = item["title"].lower().strip()[:60]
        if normalised not in seen_titles:
            seen_titles.add(normalised)
            unique.append(item)
    return unique


def fetch_news(category: str = "all", limit: int = 50) -> list[dict[str, Any]]:
    """Fetch live news from RSS feeds.

    Parameters
    ----------
    category:
        Feed category or ``"all"`` for everything.
    limit:
        Max items to return.
    """
    items: list[dict[str, Any]] = []

    if category == "all":
        for cat, urls in RSS_FEEDS.items():
            for url in urls:
                items.extend(_parse_feed(url, cat))
    elif category in RSS_FEEDS:
        for url in RSS_FEEDS[category]:
            items.extend(_parse_feed(url, category))
    else:
        logger.warning("Unknown category: %s", category)
        return []

    items = _deduplicate(items)
    items.sort(key=lambda x: x.get("published", ""), reverse=True)
    return items[:limit]


def fetch_ticker_news(ticker: str, limit: int = 20) -> list[dict[str, Any]]:
    """Fetch news specific to a stock ticker."""
    url = f"https://news.google.com/rss/search?q={ticker}+stock+when:7d&hl=en-US&gl=US&ceid=US:en"
    items = _parse_feed(url, "ticker")
    items = _deduplicate(items)
    return items[:limit]


def fetch_market_summary() -> dict[str, Any]:
    """Aggregate headlines by category with counts."""
    summary: dict[str, Any] = {"categories": {}, "total_headlines": 0}
    for cat, urls in RSS_FEEDS.items():
        items: list[dict[str, Any]] = []
        for url in urls:
            items.extend(_parse_feed(url, cat))
        summary["categories"][cat] = {
            "count": len(items),
            "top_headlines": [i["title"] for i in items[:5]],
        }
        summary["total_headlines"] += len(items)
    return summary
