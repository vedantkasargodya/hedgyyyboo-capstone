"""
Hedgyyyboo — LLM translation layer via OpenRouter.

Translates raw PCA + LDA quant output into actionable natural-language
summaries for the portfolio manager.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-3n-e4b-it:free"

SYSTEM_PROMPT = (
    "You are a senior hedge fund PM's AI assistant. "
    "Translate quantitative analysis into 2-3 sentence actionable summaries. "
    "Be specific about sectors, regions, and risk levels. "
    "Address the PM as 'Vedant'."
)


def _build_user_prompt(pca_results: dict[str, Any], lda_results: dict[str, Any]) -> str:
    """Format the quant output into a structured prompt for the LLM."""
    interp = pca_results.get("interpretation", {})
    topics = lda_results.get("topics", [])
    regime = lda_results.get("regime_summary", "N/A")

    # PCA summary
    explained = pca_results.get("explained_variance_ratio", [])
    explained_str = ", ".join(f"PC{i+1}: {v:.1%}" for i, v in enumerate(explained))

    pc1_loadings = pca_results.get("component_loadings", {}).get("PC1", {})
    top_movers = ", ".join(
        f"{ticker} ({loading:+.4f})"
        for ticker, loading in list(pc1_loadings.items())[:5]
    )

    # LDA summary
    topic_lines = "\n".join(
        f"  - {t['topic_name']} (weight {t['weight']:.1%}): {', '.join(t['top_words'][:5])}"
        for t in topics[:5]
    )

    prompt = f"""Here is the latest quantitative analysis for the global portfolio:

## PCA Results (Return Decomposition)
- Explained variance: {explained_str}
- Systemic risk: {interp.get('systemic_risk_pct', 'N/A')}%
- Idiosyncratic risk: {interp.get('idiosyncratic_risk_pct', 'N/A')}%
- Dominant sector in PC1: {interp.get('dominant_sector', 'N/A')}
- Top PC1 movers: {top_movers}

## LDA Results (Narrative Regime)
- Market regime: {regime}
- Topic breakdown:
{topic_lines}

Translate this into a concise, actionable briefing for the PM. Focus on what matters for portfolio positioning."""

    return prompt


def _generate_fallback_summary(
    pca_results: dict[str, Any],
    lda_results: dict[str, Any],
) -> str:
    """Produce a deterministic fallback summary when the LLM call is unavailable."""
    interp = pca_results.get("interpretation", {})
    systemic = interp.get("systemic_risk_pct", 0)
    dominant = interp.get("dominant_sector", "Unknown")
    regime = lda_results.get("regime_summary", "")

    risk_label = "elevated" if systemic > 50 else "moderate"

    topics = lda_results.get("topics", [])
    top_topic = topics[0]["topic_name"] if topics else "macro uncertainty"

    return (
        f"Vedant, systemic risk concentration is {risk_label} at {systemic:.1f}% "
        f"with {dominant} as the dominant factor in PC1. "
        f"The prevailing narrative regime centres on {top_topic}. "
        f"{regime} "
        f"Consider reviewing exposure to {dominant}-heavy names and monitoring "
        f"headline flow for regime shifts."
    )


DERIVATIVES_SYSTEM_PROMPT = (
    "You are a senior derivatives desk PM's AI assistant. "
    "Produce exactly 2 sentences about the current volatility and contagion landscape. "
    "Reference specific IV skew numbers, GARCH conditional volatilities, and cross-market correlations. "
    "Address the PM as 'Vedant'."
)


def _build_derivatives_prompt(vol_data: dict[str, Any], tail_risk_data: dict[str, Any]) -> str:
    """Build a prompt from vol surface skew and GARCH contagion data."""
    skew = vol_data.get("skew_analysis", {})
    put_iv = skew.get("put_iv_avg", 0)
    call_iv = skew.get("call_iv_avg", 0)
    skew_ratio = skew.get("skew_ratio", 0)
    spot = vol_data.get("spot_price", 0)

    markets = tail_risk_data.get("markets", [])
    links = tail_risk_data.get("contagion_links", [])
    summary = tail_risk_data.get("risk_summary", "")

    market_lines = "\n".join(
        f"  - {m.get('name', m.get('symbol','?'))}: cond vol {m.get('current_vol', 0):.2f}%, "
        f"annualised {m.get('annualised_vol', 0):.2%}, "
        f"1w change {m.get('vol_change_1w', 0):+.1f}%"
        for m in markets[:5]
    )

    top_links = "\n".join(
        f"  - {l.get('source','?')} <-> {l.get('target','?')}: {l.get('correlation', 0):.3f} ({l.get('strength','?')})"
        for l in links[:3]
    )

    return f"""Current derivatives desk data:

## SPY Volatility Surface (spot ${spot:.2f})
- Put IV avg: {put_iv:.1%}, Call IV avg: {call_iv:.1%}
- Skew ratio (Put/Call): {skew_ratio:.4f}
- {'PUT SKEW STEEPENING — institutional hedging detected' if skew_ratio > 1.0 else 'CALL SKEW DOMINANT — risk-on positioning'}

## GARCH(1,1) Cross-Market Contagion
{market_lines}

## Top Contagion Links (60-day rolling correlation)
{top_links}

Risk summary: {summary}

Give exactly 2 sentences summarising the derivatives landscape for the PM."""


def _derivatives_fallback(vol_data: dict[str, Any], tail_risk_data: dict[str, Any]) -> str:
    """Deterministic fallback for derivatives brief."""
    skew = vol_data.get("skew_analysis", {})
    skew_ratio = skew.get("skew_ratio", 0)
    put_iv = skew.get("put_iv_avg", 0)
    call_iv = skew.get("call_iv_avg", 0)

    markets = tail_risk_data.get("markets", [])
    links = tail_risk_data.get("contagion_links", [])

    skew_msg = "put skew is steepening, indicating institutional hedging" if skew_ratio > 1.0 else f"call skew dominates at {skew_ratio:.2f}"

    high_vol = [m["name"] for m in markets if m.get("current_vol") and m["current_vol"] > 2.0]
    top_link = links[0] if links else None

    contagion_msg = ""
    if top_link:
        contagion_msg = (
            f"GARCH models show a {abs(top_link.get('correlation', 0)):.0%} correlation "
            f"between {top_link.get('source', '?')} and {top_link.get('target', '?')} equities."
        )

    return (
        f"Vedant, SPY {skew_msg} (Put IV {put_iv:.1%} vs Call IV {call_iv:.1%}). "
        f"{contagion_msg}"
        + (f" Elevated vol in {', '.join(high_vol)}." if high_vol else "")
    )


async def translate_derivatives(
    vol_data: dict[str, Any],
    tail_risk_data: dict[str, Any],
) -> str:
    """Translate vol surface + GARCH data into a PM-ready derivatives brief."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")

    if not api_key or api_key == "your_openrouter_api_key_here":
        logger.warning("OPENROUTER_API_KEY not set — returning derivatives fallback.")
        return _derivatives_fallback(vol_data, tail_risk_data)

    user_prompt = _build_derivatives_prompt(vol_data, tail_risk_data)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": f"{DERIVATIVES_SYSTEM_PROMPT}\n\n{user_prompt}"},
        ],
        "max_tokens": 256,
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hedgyyyboo.dev",
        "X-Title": "Hedgyyyboo Research Terminal",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content: str = data["choices"][0]["message"]["content"]
            return content.strip()
    except Exception as exc:
        logger.error("OpenRouter derivatives call failed: %s", exc)
        return _derivatives_fallback(vol_data, tail_risk_data)


async def translate_analysis(
    pca_results: dict[str, Any],
    lda_results: dict[str, Any],
) -> str:
    """Call OpenRouter to translate quant analysis into a PM-ready summary.

    Falls back to a deterministic summary if the API key is missing or the
    call fails, so the endpoint never crashes.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "")

    if not api_key or api_key == "your_openrouter_api_key_here":
        logger.warning("OPENROUTER_API_KEY not set — returning fallback summary.")
        return _generate_fallback_summary(pca_results, lda_results)

    user_prompt = _build_user_prompt(pca_results, lda_results)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": f"{SYSTEM_PROMPT}\n\n{user_prompt}"},
        ],
        "max_tokens": 512,
        "temperature": 0.4,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hedgyyyboo.dev",
        "X-Title": "Hedgyyyboo Research Terminal",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content: str = data["choices"][0]["message"]["content"]
            return content.strip()
    except Exception as exc:
        logger.error("OpenRouter call failed: %s", exc)
        return _generate_fallback_summary(pca_results, lda_results)


# ===========================================================================
# PHASE 5 — FIXED INCOME & RATES DESK
# ===========================================================================

RATES_SYSTEM_PROMPT = (
    "You are a senior rates desk PM's AI assistant. "
    "Produce exactly 2-3 sentences about the current fixed income landscape. "
    "Reference specific yield levels, curve shape, spread levels, and any inversion signals. "
    "Mention the NSS fit quality and Hull-White swaption pricing if available. "
    "Address the PM as 'Vedant'."
)


def _build_rates_prompt(fi_data: dict[str, Any], nss_data: dict[str, Any] | None, hw_data: dict[str, Any] | None) -> str:
    """Build a prompt from fixed income, NSS curve fit, and swaption data."""
    yields = fi_data.get("yields", {})
    spreads = fi_data.get("spreads", {})
    inversion = fi_data.get("inversion_status", "UNKNOWN")
    credit = fi_data.get("credit", [])

    yield_lines = "\n".join(f"  - {tenor}: {y:.2f}%" for tenor, y in yields.items() if y is not None)
    spread_lines = "\n".join(f"  - {name}: {s * 100:.0f}bps" if s is not None else f"  - {name}: N/A" for name, s in spreads.items())
    credit_lines = "\n".join(f"  - {c['name']} ({c['symbol']}): ${c['price']:.2f} ({c['change_pct']:+.2f}%)" for c in credit)

    nss_section = ""
    if nss_data and nss_data.get("status") == "ok":
        interp = nss_data.get("interpretation", {})
        nss_section = f"""
## NSS Yield Curve Fit
- Curve shape: {interp.get('curve_shape', 'N/A')}
- Long-term rate (b0): {interp.get('long_term_rate', 'N/A')}%
- Slope factor (b1): {interp.get('slope_factor', 'N/A')}
- RMSE: {nss_data.get('rmse_pct', 0):.4f}%"""

    hw_section = ""
    if hw_data and hw_data.get("status") == "ok":
        hw_section = f"""
## Hull-White Swaption Pricing
- {hw_data['params']['option_expiry']}Y x {hw_data['params']['swap_tenor']}Y payer swaption
- Price: ${hw_data['swaption_price']:,.2f} ({hw_data['swaption_price_bps']:.1f} bps of notional)
- DV01: ${hw_data['delta_01']:,.2f}
- Computed on {hw_data['device_used'].upper()} in {hw_data['computation_time_ms']:.0f}ms"""

    return f"""Current fixed income and rates desk data:

## Treasury Yields
{yield_lines}
- Curve status: {inversion}

## Key Spreads
{spread_lines}

## Credit Markets
{credit_lines}
{nss_section}
{hw_section}

Give 2-3 sentences summarising the rates landscape for the PM."""


def _rates_fallback(fi_data: dict[str, Any], nss_data: dict[str, Any] | None, hw_data: dict[str, Any] | None) -> str:
    """Deterministic fallback for rates brief."""
    yields = fi_data.get("yields", {})
    spreads = fi_data.get("spreads", {})
    inversion = fi_data.get("inversion_status", "NORMAL")

    y10 = yields.get("10Y", 0)
    y2 = yields.get("2Y", 0)
    s2s10 = spreads.get("2s10s")

    curve_msg = f"The 10Y yield stands at {y10:.2f}%"
    if s2s10 is not None:
        curve_msg += f" with the 2s10s spread at {s2s10 * 100:.0f}bps"
        if inversion == "INVERTED":
            curve_msg += " — curve remains inverted, signalling recession risk"
        elif inversion == "FLAT":
            curve_msg += " — curve is dangerously flat"
        else:
            curve_msg += " — curve is normally shaped"
    curve_msg += "."

    hw_msg = ""
    if hw_data and hw_data.get("status") == "ok":
        hw_msg = (
            f" The {hw_data['params']['option_expiry']:.0f}Y x {hw_data['params']['swap_tenor']:.0f}Y "
            f"payer swaption prices at ${hw_data['swaption_price']:,.0f} "
            f"({hw_data['swaption_price_bps']:.1f}bps)."
        )

    return f"Vedant, {curve_msg}{hw_msg}"


async def translate_rates(
    fi_data: dict[str, Any],
    nss_data: dict[str, Any] | None = None,
    hw_data: dict[str, Any] | None = None,
) -> str:
    """Translate fixed income data into a PM-ready rates brief."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")

    if not api_key or api_key == "your_openrouter_api_key_here":
        logger.warning("OPENROUTER_API_KEY not set — returning rates fallback.")
        return _rates_fallback(fi_data, nss_data, hw_data)

    user_prompt = _build_rates_prompt(fi_data, nss_data, hw_data)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": f"{RATES_SYSTEM_PROMPT}\n\n{user_prompt}"},
        ],
        "max_tokens": 300,
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hedgyyyboo.dev",
        "X-Title": "Hedgyyyboo Research Terminal",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content: str = data["choices"][0]["message"]["content"]
            return content.strip()
    except Exception as exc:
        logger.error("OpenRouter rates call failed: %s", exc)
        return _rates_fallback(fi_data, nss_data, hw_data)
