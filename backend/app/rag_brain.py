"""
Hedgyyyboo Phase 4 — Multi-Agent RAG Brain with Semantic Router.

Three routes:
  A. Derivatives / Risk → calls GARCH, Monte Carlo, Vol Surface engines
  B. Fundamental / Event → queries live stock data, filing deltas, alpha checks
  C. Macro / Supply Chain → PCA/LDA analysis, market data, news

All LLM calls go through OpenRouter (Gemma 3B) with rate limiting.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Any

import httpx

logger = logging.getLogger("hedgyyyboo.rag_brain")

# ---------------------------------------------------------------------------
# OpenRouter config
# ---------------------------------------------------------------------------

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-3n-e4b-it:free"

RATE_LIMIT_SECONDS = 12  # min delay between OpenRouter calls

_last_call_time: float = 0.0


async def _rate_limited_llm_call(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 512,
    temperature: float = 0.4,
) -> str:
    """Single OpenRouter call with rate limiting (10-15s between calls)."""
    global _last_call_time

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key or api_key == "your_openrouter_api_key_here":
        return "[LLM unavailable — set OPENROUTER_API_KEY in .env]"

    # Enforce rate limit
    elapsed = time.time() - _last_call_time
    if elapsed < RATE_LIMIT_SECONDS:
        wait = RATE_LIMIT_SECONDS - elapsed
        logger.info("Rate limiting: waiting %.1fs before next LLM call", wait)
        await asyncio.sleep(wait)

    # Gemma 3n does not support system messages — merge into user prompt
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": combined_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hedgyyyboo.dev",
        "X-Title": "Hedgyyyboo Research Terminal",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            _last_call_time = time.time()
            if response.status_code != 200:
                body = response.text[:300]
                logger.error("OpenRouter %d: %s", response.status_code, body)
                return f"[LLM error {response.status_code}: {body}]"
            data = response.json()
            content: str = data["choices"][0]["message"]["content"]
            return content.strip()
    except Exception as exc:
        logger.error("OpenRouter call failed: %s", exc)
        return f"[LLM error: {exc}]"


# ---------------------------------------------------------------------------
# Semantic Router — classify user query into route
# ---------------------------------------------------------------------------

ROUTE_PATTERNS = {
    "derivatives": [
        r"vol(atility)?", r"options?", r"iv\b", r"skew", r"surface",
        r"garch", r"tail.?risk", r"contagion", r"correlation",
        r"monte.?carlo", r"barrier", r"put\b", r"call\b", r"greek",
        r"delta\b", r"gamma\b", r"vega\b", r"theta\b",
        r"hedg(e|ing)", r"derivative", r"straddle", r"strangle",
    ],
    "fundamental": [
        r"stock", r"price", r"earnings", r"revenue", r"eps\b",
        r"p/?e\b", r"filing", r"10-[kq]", r"sec\b", r"alpha",
        r"fundamental", r"valuation", r"market.?cap", r"dividend",
        r"balance.?sheet", r"cash.?flow", r"profit", r"loss",
        r"ticker", r"aapl|msft|googl|amzn|nvda|tsla|meta|jpm|gs|spy",
    ],
    "macro": [
        r"macro", r"pca\b", r"lda\b", r"regime", r"sector",
        r"market.?data", r"systemic", r"idiosyncratic", r"risk.?factor",
        r"supply.?chain", r"geopolitical", r"inflation", r"rates?",
        r"fed\b", r"central.?bank", r"gdp\b", r"employment",
        r"news", r"headline", r"sentiment", r"narrative",
        r"portfolio", r"allocation", r"exposure", r"overview",
        r"briefing", r"summary", r"morning.?note",
    ],
}


def classify_route(query: str) -> str:
    """Classify a user query into one of 3 routes using regex patterns."""
    query_lower = query.lower()
    scores = {"derivatives": 0, "fundamental": 0, "macro": 0}

    for route, patterns in ROUTE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query_lower):
                scores[route] += 1

    best_route = max(scores, key=scores.get)  # type: ignore[arg-type]

    # Default to macro if no matches
    if scores[best_route] == 0:
        return "macro"

    logger.info("Route classification: %s (scores: %s)", best_route, scores)
    return best_route


# ---------------------------------------------------------------------------
# Route A: Derivatives / Risk
# ---------------------------------------------------------------------------

DERIVATIVES_SYSTEM = (
    "You are Hedgyyyboo, an AI derivatives desk analyst for PM Vedant. "
    "Answer using the provided live data. Be specific about numbers. "
    "Keep responses concise (3-5 sentences max). Address PM as 'Vedant'."
)


async def _handle_derivatives(query: str) -> dict[str, Any]:
    """Fetch live derivatives data and generate LLM response."""
    context_parts = []

    # Fetch vol surface
    try:
        from app.vol_surface import get_vol_surface
        vol_data = await get_vol_surface("SPY")
        skew = vol_data.get("skew_analysis", {})
        context_parts.append(
            f"SPY Vol Surface: Put IV avg {skew.get('put_iv_avg', 0):.1%}, "
            f"Call IV avg {skew.get('call_iv_avg', 0):.1%}, "
            f"Skew ratio {skew.get('skew_ratio', 0):.4f}, "
            f"Spot ${vol_data.get('spot_price', 0):.2f}, "
            f"{vol_data.get('total_strikes', 0)} strikes across "
            f"{vol_data.get('expirations_used', 0)} expirations."
        )
    except Exception as exc:
        context_parts.append(f"[Vol surface unavailable: {exc}]")

    # Fetch tail risk
    try:
        from app.garch_engine import get_tail_risk
        tail_data = await get_tail_risk()
        markets = tail_data.get("markets", [])
        for m in markets[:3]:
            if m.get("current_vol"):
                context_parts.append(
                    f"{m['name']}: cond vol {m['current_vol']:.4f}%, "
                    f"annualised {m.get('annualised_vol', 0):.2%}, "
                    f"1w change {m.get('vol_change_1w', 0):+.1f}%"
                )
        links = tail_data.get("contagion_links", [])
        for link in links[:3]:
            context_parts.append(
                f"Contagion: {link['source']} <-> {link['target']}: "
                f"{link['correlation']:.3f} ({link['strength']})"
            )
        context_parts.append(f"Risk summary: {tail_data.get('risk_summary', '')}")
    except Exception as exc:
        context_parts.append(f"[Tail risk unavailable: {exc}]")

    context = "\n".join(context_parts)
    user_prompt = f"Live derivatives data:\n{context}\n\nPM's question: {query}"

    llm_response = await _rate_limited_llm_call(DERIVATIVES_SYSTEM, user_prompt)

    return {
        "route": "derivatives",
        "response": llm_response,
        "data_sources": ["vol_surface", "garch_tail_risk"],
    }


# ---------------------------------------------------------------------------
# Route B: Fundamental / Event
# ---------------------------------------------------------------------------

FUNDAMENTAL_SYSTEM = (
    "You are Hedgyyyboo, an AI equity research analyst for PM Vedant. "
    "Answer using the provided live stock and filing data. Be specific. "
    "Keep responses concise (3-5 sentences max). Address PM as 'Vedant'."
)


async def _handle_fundamental(query: str) -> dict[str, Any]:
    """Fetch live stock data and generate LLM response."""
    context_parts = []

    # Extract ticker from query
    ticker_match = re.search(
        r"\b(AAPL|MSFT|GOOGL|AMZN|NVDA|TSLA|META|JPM|GS|SPY|QQQ|GOOG|AMD|NFLX|DIS|BA|V|MA|WMT|HD)\b",
        query.upper(),
    )
    ticker = ticker_match.group(0) if ticker_match else "SPY"

    # Fetch stock data
    try:
        from app.stock_data import get_live_stock_data
        stock = get_live_stock_data(ticker)
        if "error" not in stock:
            context_parts.append(
                f"{ticker}: ${stock.get('price', 0):.2f}, "
                f"change {stock.get('change_pct', 0):+.2f}%, "
                f"market cap ${stock.get('market_cap', 0):,.0f}, "
                f"P/E {stock.get('pe_ratio', 'N/A')}, "
                f"52w range ${stock.get('fifty_two_week_low', 0):.2f}-${stock.get('fifty_two_week_high', 0):.2f}"
            )
    except Exception as exc:
        context_parts.append(f"[Stock data unavailable: {exc}]")

    # Fetch batch quotes for context
    try:
        from app.stock_data import get_batch_quotes
        quotes = get_batch_quotes(["SPY", "QQQ", ticker])
        for q in quotes:
            if q.get("ticker") != ticker:
                context_parts.append(
                    f"{q['ticker']}: ${q.get('price', 0):.2f} ({q.get('change_pct', 0):+.2f}%)"
                )
    except Exception as exc:
        context_parts.append(f"[Batch quotes unavailable: {exc}]")

    context = "\n".join(context_parts)
    user_prompt = f"Live market data:\n{context}\n\nPM's question: {query}"

    llm_response = await _rate_limited_llm_call(FUNDAMENTAL_SYSTEM, user_prompt)

    return {
        "route": "fundamental",
        "ticker": ticker,
        "response": llm_response,
        "data_sources": ["stock_data", "batch_quotes"],
    }


# ---------------------------------------------------------------------------
# Route C: Macro / Supply Chain
# ---------------------------------------------------------------------------

MACRO_SYSTEM = (
    "You are Hedgyyyboo, an AI macro strategist for PM Vedant. "
    "Answer using the provided PCA/LDA analysis and market data. Be specific. "
    "Keep responses concise (3-5 sentences max). Address PM as 'Vedant'."
)


async def _handle_macro(query: str) -> dict[str, Any]:
    """Fetch PCA/LDA analysis and news, generate LLM response."""
    context_parts = []

    # Run PCA/LDA
    try:
        from app.data_generator import generate_market_data, generate_news_headlines
        from app.math_engine import run_pca_analysis, run_lda_analysis

        market_df = generate_market_data()
        headlines = generate_news_headlines()
        pca = run_pca_analysis(market_df)
        lda = run_lda_analysis(headlines)

        interp = pca.get("interpretation", {})
        context_parts.append(
            f"PCA: Systemic risk {interp.get('systemic_risk_pct', 0):.1f}%, "
            f"Idiosyncratic {interp.get('idiosyncratic_risk_pct', 0):.1f}%, "
            f"Dominant sector: {interp.get('dominant_sector', 'N/A')}"
        )

        topics = lda.get("topics", [])
        for t in topics[:3]:
            context_parts.append(
                f"Topic '{t['topic_name']}' (weight {t['weight']:.1%}): "
                f"{', '.join(t['top_words'][:5])}"
            )
        context_parts.append(f"Regime: {lda.get('regime_summary', 'N/A')}")
    except Exception as exc:
        context_parts.append(f"[PCA/LDA unavailable: {exc}]")

    # Fetch news
    try:
        from app.news_feed import fetch_news
        news = fetch_news(category="all", limit=5)
        for item in news[:3]:
            context_parts.append(f"News: {item.get('title', 'N/A')}")
    except Exception as exc:
        context_parts.append(f"[News unavailable: {exc}]")

    context = "\n".join(context_parts)
    user_prompt = f"Macro analysis data:\n{context}\n\nPM's question: {query}"

    llm_response = await _rate_limited_llm_call(MACRO_SYSTEM, user_prompt)

    return {
        "route": "macro",
        "response": llm_response,
        "data_sources": ["pca_analysis", "lda_analysis", "news_feed"],
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def ask_pm(query: str) -> dict[str, Any]:
    """Route a PM query through the semantic router and generate a response."""
    route = classify_route(query)
    logger.info("Ask PM query: '%s' → route: %s", query[:80], route)

    if route == "derivatives":
        return await _handle_derivatives(query)
    elif route == "fundamental":
        return await _handle_fundamental(query)
    else:
        return await _handle_macro(query)
