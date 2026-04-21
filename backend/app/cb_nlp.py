"""
Hedgyyyboo Phase 6 — Central Bank NLP Engine.

Downloads and analyses latest Fed/ECB monetary policy statements.
Uses keyword-based Hawkish/Dovish scoring (no external vector DB required).
Compares current vs prior statement for divergence.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

import requests

logger = logging.getLogger("hedgyyyboo.cb_nlp")

# ---------------------------------------------------------------------------
# Hawkish / Dovish keyword dictionaries
# ---------------------------------------------------------------------------

HAWKISH_KEYWORDS = [
    "inflation", "tightening", "restrictive", "rate hike", "overheating",
    "price stability", "above target", "upside risks", "wage growth",
    "strong demand", "reduce balance sheet", "tapering", "hawkish",
    "further increases", "appropriate to raise", "persistent inflation",
    "remain elevated", "vigilant", "decisive action", "curb inflation",
]

DOVISH_KEYWORDS = [
    "accommodative", "easing", "rate cut", "slowdown", "recession",
    "downside risks", "below target", "weak demand", "labor weakness",
    "dovish", "patient", "gradual", "pause", "flexibility",
    "support growth", "appropriate to lower", "monitor carefully",
    "economic uncertainty", "financial conditions", "soft landing",
]

# ---------------------------------------------------------------------------
# Fed statements (RSS-accessible summaries)
# ---------------------------------------------------------------------------

FED_RECENT_STATEMENTS_URL = "https://www.federalreserve.gov/feeds/press_monetary.xml"
ECB_PRESS_URL = "https://www.ecb.europa.eu/rss/press.html"


def _compute_hawk_dove_score(text: str) -> dict[str, Any]:
    """Score a text block for hawkish vs dovish tone.

    Returns a score from -1 (fully dovish) to +1 (fully hawkish).
    """
    text_lower = text.lower()

    hawk_count = sum(1 for kw in HAWKISH_KEYWORDS if kw in text_lower)
    dove_count = sum(1 for kw in DOVISH_KEYWORDS if kw in text_lower)

    total = hawk_count + dove_count
    if total == 0:
        return {
            "score": 0.0,
            "label": "NEUTRAL",
            "hawkish_hits": 0,
            "dovish_hits": 0,
            "hawkish_keywords": [],
            "dovish_keywords": [],
        }

    # Score: (hawk - dove) / total, range [-1, +1]
    score = round((hawk_count - dove_count) / total, 4)

    # Get matched keywords
    hawk_matched = [kw for kw in HAWKISH_KEYWORDS if kw in text_lower]
    dove_matched = [kw for kw in DOVISH_KEYWORDS if kw in text_lower]

    label = "HAWKISH" if score > 0.15 else "DOVISH" if score < -0.15 else "NEUTRAL"

    return {
        "score": score,
        "label": label,
        "hawkish_hits": hawk_count,
        "dovish_hits": dove_count,
        "hawkish_keywords": hawk_matched[:5],
        "dovish_keywords": dove_matched[:5],
    }


def fetch_fed_statement_analysis() -> dict[str, Any]:
    """Fetch and analyse the latest Fed monetary policy communication."""
    try:
        # Fetch Fed RSS feed for latest monetary policy press releases
        resp = requests.get(FED_RECENT_STATEMENTS_URL, timeout=15)
        resp.raise_for_status()

        from lxml import etree
        root = etree.fromstring(resp.content)

        # Extract items from RSS
        items = []
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        # Try Atom format
        entries = root.findall(".//atom:entry", ns) or root.findall(".//item")

        for entry in entries[:5]:  # Last 5 releases
            title = entry.findtext("atom:title", "", ns) or entry.findtext("title", "")
            summary = entry.findtext("atom:summary", "", ns) or entry.findtext("description", "")
            link = ""
            link_el = entry.find("atom:link", ns)
            if link_el is not None:
                link = link_el.get("href", "")
            else:
                link = entry.findtext("link", "")

            date = entry.findtext("atom:updated", "", ns) or entry.findtext("pubDate", "")

            if title:
                items.append({
                    "title": title.strip(),
                    "summary": re.sub(r"<[^>]+>", "", summary.strip())[:500],
                    "link": link.strip(),
                    "date": date.strip()[:25],
                })

        if not items:
            return {
                "status": "no_data",
                "bank": "Federal Reserve",
                "message": "No recent monetary policy statements found",
                "hawk_dove": {"score": 0, "label": "NEUTRAL", "hawkish_hits": 0, "dovish_hits": 0, "hawkish_keywords": [], "dovish_keywords": []},
                "statements": [],
            }

        # Analyse the combined text of recent statements
        combined_text = " ".join(item["summary"] for item in items if item["summary"])
        hawk_dove = _compute_hawk_dove_score(combined_text)

        # Compare latest vs previous for divergence
        divergence = None
        if len(items) >= 2 and items[0]["summary"] and items[1]["summary"]:
            current_score = _compute_hawk_dove_score(items[0]["summary"])
            prior_score = _compute_hawk_dove_score(items[1]["summary"])
            divergence = {
                "current_score": current_score["score"],
                "prior_score": prior_score["score"],
                "delta": round(current_score["score"] - prior_score["score"], 4),
                "shift": "MORE HAWKISH" if current_score["score"] > prior_score["score"] else "MORE DOVISH" if current_score["score"] < prior_score["score"] else "UNCHANGED",
            }

        logger.info("Fed NLP — score=%.3f label=%s hawk=%d dove=%d",
                     hawk_dove["score"], hawk_dove["label"],
                     hawk_dove["hawkish_hits"], hawk_dove["dovish_hits"])

        return {
            "status": "ok",
            "bank": "Federal Reserve",
            "hawk_dove": hawk_dove,
            "divergence": divergence,
            "statements": items,
            "analysed_at": datetime.now().isoformat(),
        }

    except Exception as exc:
        logger.error("Fed statement analysis failed: %s", exc)
        return {
            "status": "error",
            "bank": "Federal Reserve",
            "message": str(exc),
            "hawk_dove": {"score": 0, "label": "NEUTRAL", "hawkish_hits": 0, "dovish_hits": 0, "hawkish_keywords": [], "dovish_keywords": []},
            "statements": [],
        }


async def get_cb_analysis() -> dict[str, Any]:
    """Get central bank analysis for all monitored banks."""
    fed = fetch_fed_statement_analysis()
    return {
        "status": "ok",
        "banks": [fed],
        "overall_tone": fed["hawk_dove"]["label"],
        "overall_score": fed["hawk_dove"]["score"],
    }
