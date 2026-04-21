"""
Hedgyyyboo Phase 6 — AI PM FX Execution Engine.

Synthesises all quant signals (OU, Hurst, Neural SDE, Forex Factory,
CB NLP) and makes autonomous trade decisions via OpenRouter LLM.
Logs trades directly to PostgreSQL.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Any

import httpx
import numpy as np

from app.trade_ledger import insert_trade, get_open_trades, update_all_open_prices

logger = logging.getLogger("hedgyyyboo.fx_pm_executor")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-3n-e4b-it:free"

FX_PM_SYSTEM_PROMPT = """You are a senior FX macro PM at a systematic hedge fund. You make autonomous FX trades.

RULES:
1. You MUST output exactly one trade decision in this format:
   TRADE: [LONG/SHORT] [PAIR] RATIONALE: [2 sentences max]
2. Base your decision on ALL signals provided:
   - OU half-life & mean-reversion (quant)
   - Hurst exponent (rough vol regime)
   - Neural SDE drift (ML-learned dynamics)
   - Forex Factory events (macro surprises)
   - Central Bank NLP (hawkish/dovish tone)
   - CFTC COT positioning (hedge fund crowding)
   - GDELT geopolitical stress (risk-on/off)
   - Interbank stress (funding/liquidity)
3. If the OU process shows strong mean-reversion (half-life < 30 days) and the pair has deviated from mu, trade the reversion.
4. If Neural SDE drift is strongly directional, trade with the drift.
5. If COT shows extreme positioning, fade the crowd (contrarian).
6. If GDELT stress is CRITICAL, bias towards safe havens (USD, CHF, JPY).
7. If interbank stress is ELEVATED, the USD gets safe-haven bid.
8. If Forex Factory shows a data surprise, trade the immediate reaction.
9. If signals conflict, express NO TRADE.
10. Address the PM as 'Vedant'.

Example output:
TRADE: LONG EUR/USD RATIONALE: OU half-life of 15 days with current price 2.1 sigma below mu suggests imminent mean reversion. COT shows speculative shorts overcrowded at -25% OI, Neural SDE drift confirms bullish momentum."""


def _build_fx_pm_prompt(
    pair: str,
    spot_price: float,
    ou_result: dict[str, Any],
    hurst_result: dict[str, Any],
    neural_sde_result: dict[str, Any],
    ff_events: dict[str, Any],
    cb_analysis: dict[str, Any],
    cot_data: dict[str, Any] | None = None,
    gdelt_data: dict[str, Any] | None = None,
    interbank_data: dict[str, Any] | None = None,
) -> str:
    """Build the comprehensive prompt for the AI PM."""

    # OU section
    ou_section = f"""## Ornstein-Uhlenbeck Analysis ({pair})
- Half-life: {ou_result.get('half_life_days', 'N/A')} days
- Mean-reverting: {ou_result.get('is_mean_reverting', False)}
- Kappa (speed): {ou_result.get('kappa', 0):.4f}
- Long-run mean (mu): {ou_result.get('mu', 0):.6f}
- Current log-price: {np.log(spot_price):.6f}
- Deviation from mu: {np.log(spot_price) - ou_result.get('mu', np.log(spot_price)):.6f}"""

    # Hurst section
    hurst_section = f"""## Rough Volatility Analysis
- Hurst exponent: {hurst_result.get('hurst_exponent', 'N/A')}
- Classification: {hurst_result.get('roughness_label', 'N/A')}
- {hurst_result.get('interpretation', '')}"""

    # Neural SDE section
    nsde_section = f"""## Neural SDE Learned Dynamics
- Learned drift: {neural_sde_result.get('learned_drift', 0):.6f}
- Learned diffusion: {neural_sde_result.get('learned_diffusion', 0):.6f}
- Drift direction: {neural_sde_result.get('drift_direction', 'NEUTRAL')}
- Training loss: {neural_sde_result.get('final_loss', 'N/A')}"""

    # Forex Factory section
    ff_released = ff_events.get("released_events", [])[:3]
    ff_upcoming = ff_events.get("upcoming_events", [])[:3]
    ff_lines = []
    for e in ff_released:
        ff_lines.append(f"  - [RELEASED] {e['country']} {e['title']}: actual={e['actual']} forecast={e['forecast']} surprise={e.get('surprise_direction', 'N/A')}")
    for e in ff_upcoming:
        ff_lines.append(f"  - [UPCOMING] {e['country']} {e['title']}: forecast={e['forecast']}")
    ff_section = f"""## Forex Factory Events
{chr(10).join(ff_lines) if ff_lines else '  No high-impact events this session.'}"""

    # CB NLP section
    banks = cb_analysis.get("banks", [])
    cb_lines = []
    for bank in banks:
        hd = bank.get("hawk_dove", {})
        cb_lines.append(f"  - {bank.get('bank', '?')}: {hd.get('label', 'NEUTRAL')} (score: {hd.get('score', 0):.3f})")
        div = bank.get("divergence")
        if div:
            cb_lines.append(f"    Shift: {div.get('shift', 'UNCHANGED')} (delta: {div.get('delta', 0):.3f})")
    cb_section = f"""## Central Bank NLP
{chr(10).join(cb_lines) if cb_lines else '  No central bank data available.'}"""

    # CFTC COT section
    cot_section = "## CFTC Commitments of Traders\n  No COT data available."
    if cot_data and cot_data.get("contracts"):
        cot_lines = []
        for c in cot_data["contracts"]:
            cot_lines.append(
                f"  - {c['pair']}: Net speculative={c['net_speculative']:+d} "
                f"({c['net_pct_of_oi']:+.1f}% OI) WoW change={c['wow_change']:+d} "
                f"Signal: {c['positioning_signal']}"
            )
        cot_lines.append(f"  USD Bias: {cot_data.get('usd_bias', 'NEUTRAL')}")
        cot_section = f"""## CFTC Commitments of Traders (Hedge Fund Positioning)
{chr(10).join(cot_lines)}"""

    # GDELT section
    gdelt_section = "## Geopolitical Stress (GDELT)\n  No geopolitical data available."
    if gdelt_data and gdelt_data.get("regions"):
        gdelt_lines = [
            f"  Global Stress Index: {gdelt_data.get('global_stress_index', 0)}/100 ({gdelt_data.get('global_level', 'UNKNOWN')})",
            f"  Hotspot: {gdelt_data.get('hotspot', 'None')}",
        ]
        for r in gdelt_data["regions"][:3]:
            gdelt_lines.append(f"  - {r['label']}: stress={r['stress_score']}/100 ({r['stress_level']})")
        gdelt_section = f"""## Geopolitical Stress Index (GDELT)
{chr(10).join(gdelt_lines)}"""

    # Interbank stress section
    interbank_section = "## Interbank Funding Stress\n  No interbank data available."
    if interbank_data:
        ib_lines = [
            f"  Composite Stress: {interbank_data.get('composite_stress_index', 0)}/100 ({interbank_data.get('stress_level', 'UNKNOWN')})",
            f"  FX Signal: {interbank_data.get('fx_signal', 'NEUTRAL')}",
        ]
        for name, spread in interbank_data.get("spreads", {}).items():
            ib_lines.append(f"  - {spread.get('name', name)}: {spread.get('value_bps', 0)}bps ({spread.get('level', '?')})")
        interbank_section = f"""## Interbank Funding Stress (SOFR/OIS)
{chr(10).join(ib_lines)}"""

    return f"""Current FX analysis for {pair} (spot: {spot_price:.5f}):

{ou_section}

{hurst_section}

{nsde_section}

{ff_section}

{cb_section}

{cot_section}

{gdelt_section}

{interbank_section}

Make your trade decision now. Remember: TRADE: [LONG/SHORT] [PAIR] RATIONALE: [2 sentences]
If all signals conflict, output: TRADE: NO_TRADE {pair} RATIONALE: [reason]"""


def _parse_trade_decision(response: str, pair: str) -> dict[str, Any] | None:
    """Parse the LLM response to extract trade direction and rationale."""
    import re

    # Try to find TRADE: pattern
    match = re.search(r"TRADE:\s*(LONG|SHORT|NO_TRADE)\s+(\S+)\s+RATIONALE:\s*(.+)", response, re.IGNORECASE | re.DOTALL)
    if match:
        direction = match.group(1).upper()
        trade_pair = match.group(2).upper().replace("_", "/")
        rationale = match.group(3).strip()[:500]

        if direction == "NO_TRADE":
            return None

        return {
            "direction": direction,
            "pair": trade_pair if "/" in trade_pair else pair,
            "rationale": rationale,
        }

    # Fallback: look for LONG or SHORT keywords
    text_upper = response.upper()
    if "LONG" in text_upper and "SHORT" not in text_upper:
        return {"direction": "LONG", "pair": pair, "rationale": response.strip()[:300]}
    elif "SHORT" in text_upper and "LONG" not in text_upper:
        return {"direction": "SHORT", "pair": pair, "rationale": response.strip()[:300]}

    return None


async def execute_fx_trade(
    pair: str = "EUR/USD",
) -> dict[str, Any]:
    """Full pipeline: gather signals → LLM decision → PostgreSQL log.

    This is the autonomous execution engine.
    """
    t_start = time.perf_counter()

    # 1. Gather all data
    from app.fx_data import get_fx_spot_rates, get_fx_history, get_fx_realised_vol_series
    from app.fx_quant_engine import fit_ou_mle, compute_hurst_exponent, train_neural_sde
    from app.forex_factory import fetch_forex_factory_events
    from app.cb_nlp import get_cb_analysis

    logger.info("=== FX PM Execution Pipeline: %s ===", pair)

    # Spot price
    spots = get_fx_spot_rates()
    spot_price = 0
    for p in spots.get("pairs", []):
        if p["pair"] == pair:
            spot_price = p["price"]
            break

    if spot_price == 0:
        raise ValueError(f"Cannot get spot price for {pair}")

    # Historical data
    hist = get_fx_history(pair, "1y")
    prices = np.array([d["close"] for d in hist["data"]])

    # OU MLE
    ou_result = fit_ou_mle(np.log(prices))

    # Hurst on realised vol
    try:
        vol_series = get_fx_realised_vol_series(pair, window=20)
        hurst_result = compute_hurst_exponent(vol_series)
    except Exception as exc:
        logger.warning("Hurst computation failed: %s", exc)
        hurst_result = {"hurst_exponent": 0.5, "roughness_label": "UNKNOWN", "interpretation": "Failed to compute"}

    # Neural SDE (reduced epochs for speed)
    try:
        neural_sde_result = await train_neural_sde(prices[-120:], n_epochs=60)
    except Exception as exc:
        logger.warning("Neural SDE training failed: %s", exc)
        neural_sde_result = {"learned_drift": 0, "learned_diffusion": 0, "drift_direction": "UNKNOWN", "final_loss": "N/A"}

    # Forex Factory
    ff_events = fetch_forex_factory_events()

    # Central Bank NLP
    try:
        cb_analysis = await get_cb_analysis()
    except Exception as exc:
        logger.warning("CB analysis failed: %s", exc)
        cb_analysis = {"banks": [], "overall_tone": "UNKNOWN", "overall_score": 0}

    # CFTC COT Positioning
    cot_data = None
    try:
        from app.cftc_cot import fetch_cot_data
        cot_data = fetch_cot_data()
    except Exception as exc:
        logger.warning("CFTC COT fetch failed: %s", exc)

    # GDELT Geopolitical Stress
    gdelt_data = None
    try:
        from app.gdelt_geo import compute_geopolitical_stress_index
        gdelt_data = compute_geopolitical_stress_index()
    except Exception as exc:
        logger.warning("GDELT fetch failed: %s", exc)

    # Interbank Funding Stress
    interbank_data = None
    try:
        from app.interbank_stress import fetch_interbank_stress
        interbank_data = fetch_interbank_stress()
    except Exception as exc:
        logger.warning("Interbank stress fetch failed: %s", exc)

    # 2. Build prompt and call LLM
    prompt = _build_fx_pm_prompt(
        pair, spot_price, ou_result, hurst_result, neural_sde_result,
        ff_events, cb_analysis, cot_data, gdelt_data, interbank_data,
    )

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    trade_decision = None

    if api_key and api_key != "your_openrouter_api_key_here":
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    OPENROUTER_URL,
                    json={
                        "model": MODEL,
                        "messages": [
                            {"role": "user", "content": f"{FX_PM_SYSTEM_PROMPT}\n\n{prompt}"},
                        ],
                        "max_tokens": 200,
                        "temperature": 0.2,
                    },
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://hedgyyyboo.dev",
                        "X-Title": "Hedgyyyboo FX Desk",
                    },
                )
                response.raise_for_status()
                llm_response = response.json()["choices"][0]["message"]["content"].strip()
                trade_decision = _parse_trade_decision(llm_response, pair)
                logger.info("LLM response: %s", llm_response[:200])
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            llm_response = f"LLM call failed: {exc}"
    else:
        # Deterministic fallback based on quant signals
        llm_response = _deterministic_decision(pair, ou_result, hurst_result, neural_sde_result)
        trade_decision = _parse_trade_decision(llm_response, pair)

    # 3. Log trade to PostgreSQL
    trade_record = None
    if trade_decision:
        trade_record = insert_trade({
            "pair": trade_decision["pair"],
            "direction": trade_decision["direction"],
            "entry_price": spot_price,
            "ou_half_life": ou_result.get("half_life_days"),
            "hurst_exponent": hurst_result.get("hurst_exponent"),
            "neural_sde_drift": neural_sde_result.get("learned_drift"),
            "rationale": trade_decision["rationale"],
            "forex_factory_event": ff_events.get("released_events", [{}])[0].get("title") if ff_events.get("released_events") else None,
            "hawkish_score": cb_analysis.get("overall_score"),
        })

    t_end = time.perf_counter()
    total_time_ms = round((t_end - t_start) * 1000, 2)

    return {
        "status": "ok",
        "pair": pair,
        "spot_price": spot_price,
        "ou_analysis": ou_result,
        "hurst_analysis": hurst_result,
        "neural_sde": {
            "drift": neural_sde_result.get("learned_drift"),
            "diffusion": neural_sde_result.get("learned_diffusion"),
            "direction": neural_sde_result.get("drift_direction"),
            "forward_paths": neural_sde_result.get("sample_forward_paths", []),
        },
        "forex_factory": {
            "high_impact_count": ff_events.get("high_impact_count", 0),
            "released": ff_events.get("released_events", [])[:3],
            "upcoming": ff_events.get("upcoming_events", [])[:3],
        },
        "cb_analysis": {
            "tone": cb_analysis.get("overall_tone"),
            "score": cb_analysis.get("overall_score"),
        },
        "cot_positioning": {
            "usd_bias": cot_data.get("usd_bias") if cot_data else None,
            "contracts": len(cot_data.get("contracts", [])) if cot_data else 0,
        },
        "gdelt_stress": {
            "global_index": gdelt_data.get("global_stress_index") if gdelt_data else None,
            "global_level": gdelt_data.get("global_level") if gdelt_data else None,
            "hotspot": gdelt_data.get("hotspot") if gdelt_data else None,
        },
        "interbank_stress": {
            "composite": interbank_data.get("composite_stress_index") if interbank_data else None,
            "level": interbank_data.get("stress_level") if interbank_data else None,
            "fx_signal": interbank_data.get("fx_signal") if interbank_data else None,
        },
        "data_sources": [
            "yfinance (FX spot)",
            "OU MLE (mean reversion)",
            "Hurst/R-S (rough vol)",
            "torchsde (Neural SDE)",
            "Forex Factory (macro events)",
            "Fed RSS (CB NLP)",
            "CFTC COT (positioning)",
            "GDELT (geopolitical stress)",
            "FRED/yfinance (interbank stress)",
        ],
        "llm_response": llm_response[:500],
        "trade_executed": trade_record,
        "total_execution_time_ms": total_time_ms,
    }


def _deterministic_decision(
    pair: str,
    ou: dict[str, Any],
    hurst: dict[str, Any],
    nsde: dict[str, Any],
) -> str:
    """Deterministic fallback when no API key is available."""
    signals = []

    # OU signal
    if ou.get("is_mean_reverting") and ou.get("half_life_days", 999) < 30:
        mu = ou.get("mu", 0)
        deviation = ou.get("current_value", 0) - ou.get("mu", 0)  # Distance from OU mean
        signals.append("OU_MEAN_REVERT")

    # Neural SDE signal
    drift_dir = nsde.get("drift_direction", "NEUTRAL")
    if drift_dir == "BULLISH":
        signals.append("NSDE_LONG")
    elif drift_dir == "BEARISH":
        signals.append("NSDE_SHORT")

    # Default: trade neural SDE direction
    if "NSDE_LONG" in signals:
        return f"TRADE: LONG {pair} RATIONALE: Neural SDE drift is bullish with OU half-life of {ou.get('half_life_days', '?')} days. Hurst={hurst.get('hurst_exponent', '?'):.4f} confirms volatility regime."
    elif "NSDE_SHORT" in signals:
        return f"TRADE: SHORT {pair} RATIONALE: Neural SDE drift is bearish. OU analysis shows half-life of {ou.get('half_life_days', '?')} days with downward pressure."
    else:
        return f"TRADE: NO_TRADE {pair} RATIONALE: Conflicting signals — Neural SDE neutral, OU half-life {ou.get('half_life_days', '?')} days."
