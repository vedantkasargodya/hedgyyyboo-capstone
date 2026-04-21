"""
Hedgyyyboo Trade Engine — macro-style multi-desk autonomous trader.

Two jobs run on the APScheduler instance:

1.  ``mark_and_manage_positions``  (every 60 s)
    a. Pulls the latest price for every open position via yfinance.
    b. Writes the mark-to-market PnL back to the unified ``paper_trades`` table.
    c. Applies risk-management close rules (stop-loss / take-profit / time-stop).

2.  ``auto_pm_decision_cycle``     (every 15 min)
    a. Asks Gemma-3n (via OpenRouter) "should I open a new position?" on FX,
       equity, and rates desks in turn.
    b. Conservative: at most one new trade per call per desk, and only if
       portfolio concentration is below ``MAX_OPEN_TRADES``.

These jobs are idempotent — if the backend restarts mid-cron nothing breaks.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any

import yfinance as yf

from app.paper_trades_model import (
    CLOSE_STOP_LOSS, CLOSE_TAKE_PROFIT, CLOSE_TIME_STOP, CLOSE_TRAIL_STOP,
    DESK_EQUITY, DESK_FX, DESK_RATES, DESK_RULES,
    close_trade, insert_trade, list_trades, update_price,
)

logger = logging.getLogger("hedgyyyboo.trade_engine")

# At most this many open trades across all desks before we stop opening
# anything new. Macro desks do not churn.
MAX_OPEN_TRADES = 10


# =====================================================================
# 1. Price fetching — live feeds, no synthetic fallback
# =====================================================================

def _yf_symbol(desk: str, symbol: str) -> str | None:
    """Translate an internal Hedgyyyboo symbol into a Yahoo Finance ticker.

    Returns None if we cannot price the symbol automatically — the caller
    should then skip the mark-to-market for this trade.
    """
    if desk == DESK_FX:
        # "EUR/USD" -> "EURUSD=X"
        return symbol.replace("/", "") + "=X"
    if desk == DESK_EQUITY:
        return symbol.upper()
    if desk == DESK_RATES:
        # Accept the ten canonical UST tenors. Yahoo uses ^TNX for 10-year,
        # ^FVX for 5-year, ^TYX for 30-year, ^IRX for 13-week T-bill.
        mapping = {
            "UST10Y": "^TNX",
            "UST5Y":  "^FVX",
            "UST30Y": "^TYX",
            "UST3M":  "^IRX",
        }
        return mapping.get(symbol.upper())
    return None


def fetch_price(desk: str, symbol: str) -> float | None:
    """Return the latest yfinance close regardless of how stale it is.
    Used by mark_and_manage so stop-loss / take-profit can fire even when
    the underlying market goes quiet."""
    price_and_ts = fetch_price_with_ts(desk, symbol)
    return price_and_ts[0] if price_and_ts else None


def fetch_price_with_ts(desk: str, symbol: str) -> tuple[float, Any] | None:
    """(price, tick_timestamp) pair — used by the auto-PM opener to reject
    stale symbols."""
    yf_sym = _yf_symbol(desk, symbol)
    if yf_sym is None:
        return None
    try:
        hist = yf.Ticker(yf_sym).history(period="2d", interval="1m")
        if hist is not None and not hist.empty:
            return float(hist["Close"].iloc[-1]), hist.index[-1]
        daily = yf.Ticker(yf_sym).history(period="5d")
        if daily is not None and not daily.empty:
            return float(daily["Close"].iloc[-1]), daily.index[-1]
    except Exception as exc:                                       # pragma: no cover
        logger.warning("price fetch failed for %s/%s: %s", desk, symbol, exc)
    return None


def fetch_fresh_price(desk: str, symbol: str, max_staleness_minutes: int | None = None) -> float | None:
    """Live price only if the last tick is fresh.  Used by the auto-PM
    opener to avoid pouring new trades into symbols the feed no longer
    updates (e.g. USD/INR outside Asia hours on Yahoo free)."""
    import pandas as _pd
    from datetime import datetime as _dt, timezone as _tz
    got = fetch_price_with_ts(desk, symbol)
    if got is None:
        return None
    price, ts = got
    cap = max_staleness_minutes if max_staleness_minutes is not None else MAX_PRICE_STALENESS_MINUTES
    try:
        t = _pd.Timestamp(ts).to_pydatetime()
        if t.tzinfo is None:
            t = t.replace(tzinfo=_tz.utc)
        age_min = (_dt.now(_tz.utc) - t).total_seconds() / 60
        if age_min > cap:
            logger.info(
                "fetch_fresh_price: skip %s/%s — last tick %.1f min old (> %d)",
                desk, symbol, age_min, cap,
            )
            return None
    except Exception:
        pass
    return price


# =====================================================================
# 2. Close-rule evaluation
# =====================================================================

def _days_held(opened_at_iso: str | None) -> float:
    if not opened_at_iso:
        return 0.0
    try:
        opened = datetime.fromisoformat(opened_at_iso)
        if opened.tzinfo is None:
            opened = opened.replace(tzinfo=timezone.utc)
    except ValueError:
        return 0.0
    return (datetime.now(timezone.utc) - opened).total_seconds() / 86400.0


# Desk-specific activation threshold and trail distance for the trailing
# stop, expressed as %.  Once cumulative PnL crosses ``activate``, the stop
# is raised to (peak - trail).  A subsequent dip below that level closes
# the trade with reason TRAIL_STOP and LOCKS IN the realised profit.
TRAIL_PARAMS: dict[str, tuple[float, float]] = {
    DESK_FX:     (0.40, 0.20),   # activate at +0.40%, trail 0.20%
    DESK_EQUITY: (1.50, 0.75),   # activate at +1.50%, trail 0.75%
    DESK_RATES:  (0.30, 0.15),   # activate at +0.30%, trail 0.15%
}


def evaluate_close_rules(trade: dict[str, Any]) -> str | None:
    """Return a CLOSE_* reason if any rule fires for this trade, else None.

    Evaluation order (first hit wins):
        1. Hard stop-loss  (desk-specific absolute -%)
        2. Hard take-profit (desk-specific absolute +%)
        3. Trailing stop    (once activated, close if pnl dips trail below peak)
        4. Time stop        (max hold OR 1-day-of-no-progress)
    """
    desk  = trade["desk"]
    rules = DESK_RULES.get(desk, DESK_RULES[DESK_FX])
    pnl   = trade.get("pnl_pct") or 0.0

    # 1. hard stop
    if pnl <= rules["stop_loss_pct"]:
        return CLOSE_STOP_LOSS
    # 2. hard take-profit
    if pnl >= rules["take_profit_pct"]:
        return CLOSE_TAKE_PROFIT

    # 3. trailing stop — armed only after the trade has crossed the
    #    activation threshold for its desk.
    meta = trade.get("meta") or {}
    peak = float(meta.get("peak_pnl_pct") or 0.0)
    activate, trail = TRAIL_PARAMS.get(desk, TRAIL_PARAMS[DESK_FX])
    if peak >= activate and (peak - pnl) >= trail:
        return CLOSE_TRAIL_STOP

    # 4. time stop
    held = _days_held(trade.get("opened_at"))
    if held >= rules["max_hold_days"]:
        return CLOSE_TIME_STOP
    # tightened: 1 day of no progress closes the trade — a macro thesis
    # that hasn't started working in a full session is probably wrong.
    if held >= 1.0 and pnl < 0.3:
        return CLOSE_TIME_STOP
    return None


# =====================================================================
# 3. Main jobs — called from scheduler
# =====================================================================

async def mark_and_manage_positions() -> dict[str, Any]:
    """Runs every minute. Marks to market, then applies close rules."""
    open_trades = list_trades(status="OPEN")
    if not open_trades:
        return {"updated": 0, "closed": 0, "open_after": 0}

    updated = 0
    closed  = 0
    for t in open_trades:
        price = await asyncio.to_thread(fetch_price, t["desk"], t["symbol"])
        if price is None:
            continue
        refreshed = update_price(t["trade_id"], price)
        if refreshed is None:
            continue
        updated += 1

        reason = evaluate_close_rules(refreshed)
        if reason is not None:
            close_trade(refreshed["trade_id"], price, reason=reason)
            closed += 1

    remaining = len(list_trades(status="OPEN"))
    logger.info(
        "mark_and_manage_positions: updated=%d closed=%d open_after=%d",
        updated, closed, remaining,
    )
    return {"updated": updated, "closed": closed, "open_after": remaining}


# =====================================================================
# 4. Auto-PM — LLM-gated trade opener (macro cadence, 15-min cron)
# =====================================================================

# Small watchlists per desk.  These are not "hot" picks — they are the
# instruments the PM is willing to consider each cycle.
# FX watchlist — every pair here must have a liquid yfinance quote 24x5.
# USD/INR was dropped because Yahoo stops ticking it outside Asia hours,
# which leaves the book stuck at 0% PnL after any late-session open.
FX_WATCHLIST     = ["EUR/USD", "USD/JPY", "GBP/USD", "AUD/USD", "USD/CHF", "EUR/GBP"]
EQUITY_WATCHLIST = ["AAPL", "MSFT", "GOOGL", "NVDA", "META", "TSLA", "JPM"]
RATES_WATCHLIST  = ["UST10Y", "UST5Y", "UST30Y"]

# Auto-PM will not open a position on any symbol whose last yfinance tick
# is staler than this (its market is effectively closed / illiquid).
MAX_PRICE_STALENESS_MINUTES = 20


def _pick_candidate(open_trades: list[dict[str, Any]]) -> tuple[str, str] | None:
    """Return a (desk, symbol) pair that we do not already hold open AND whose
    desk is currently open for trading.  Returns None if every watchlist
    symbol is already in the book OR every desk is closed right now.

    Dedup is by SYMBOL regardless of direction — if we are long AAPL we do
    not immediately also want to short AAPL on the same desk; spread trades
    aren't supported yet.  We re-query list_trades(status='OPEN') inside
    this function so stale 'held' sets cannot leak through."""
    from app.paper_trades_model import list_trades
    from app.market_hours import is_desk_open
    live_open = list_trades(status="OPEN")
    held = {(t["desk"], t["symbol"]) for t in live_open}

    pools = [
        (DESK_FX,     FX_WATCHLIST),
        (DESK_EQUITY, EQUITY_WATCHLIST),
        (DESK_RATES,  RATES_WATCHLIST),
    ]
    candidates: list[tuple[str, str]] = []
    for desk, pool in pools:
        if not is_desk_open(desk):
            continue   # skip closed desks entirely
        for sym in pool:
            if (desk, sym) not in held:
                candidates.append((desk, sym))
    if not candidates:
        return None
    return random.choice(candidates)


_LLM_PROMPT_TEMPLATE = """You are a conservative macro portfolio manager at Hedgyyyboo with a small book and strict risk limits.  You must ground every recommendation in the quantitative signals below — do NOT invent numbers.

SIGNAL PACKET (live, just computed from yfinance + scipy):
{packet}

DESK RISK BUDGET (already enforced by the engine):
{risk_budget}

HOUSE STYLE
- BUY only when both (a) at least one signal supports the direction and (b) no stop-out signal is flaring.
- On FX, prefer mean-reverting entries when Hurst < 0.5 AND OU current_dev_sigmas > +1.5 (sell) or < -1.5 (buy), AND OU is_mean_reverting is true.
- On EQUITY, prefer trending/momentum entries when Hurst > 0.55 AND recent momentum (ret_20d_pct) is consistent with direction.
- On RATES, consider slope regime (steepening = long belly, flattening = long long-end).
- Output HOLD if the signals are conflicting or unconvincing. HOLD is a perfectly valid answer; the book is already allocated.

RESPOND WITH A SINGLE JSON OBJECT AND NOTHING ELSE, using EXACTLY these keys:
{{
  "action":       "BUY" | "SELL" | "HOLD",
  "confidence":   <float 0..1>,
  "entry_price":  <float|null>,
  "stop_loss":    <float|null>,
  "take_profit":  <float|null>,
  "rationale":    "<1-2 sentences citing the specific signals>"
}}
"""


async def _llm_decide(
    desk: str,
    symbol: str,
    packet: dict[str, Any],
    portfolio_context: dict[str, Any],
) -> dict[str, Any]:
    """Ask Gemma-3n to decide BUY/SELL/HOLD given the full technical packet.
    Returns a structured dict with action, levels and rationale."""
    import os, json as _json, re, httpx
    try:
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        if not api_key or api_key.startswith("your_"):
            return {
                "action": "HOLD", "rationale": "No OpenRouter key; skipping.",
                "confidence": 0.0, "entry_price": None, "stop_loss": None, "take_profit": None,
            }

        risk_budget = {
            "desk": desk,
            **{k: v for k, v in DESK_RULES.get(desk, {}).items()},
            "open_positions_in_book": portfolio_context.get("open_positions_in_book"),
        }
        prompt = _LLM_PROMPT_TEMPLATE.format(
            packet=_json.dumps(packet, indent=2, default=str),
            risk_budget=_json.dumps(risk_budget, indent=2),
        )
        payload = {
            "model": "google/gemma-3n-e4b-it:free",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 450,
            "temperature": 0.25,
        }
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        if resp.status_code != 200:
            return {
                "action": "HOLD",
                "rationale": f"LLM {resp.status_code}: {resp.text[:120]}",
                "confidence": 0.0, "entry_price": None, "stop_loss": None, "take_profit": None,
            }
        content = resp.json()["choices"][0]["message"]["content"]
        # Extract the outer-most JSON object from whatever Gemma returns.
        m = re.search(r"\{[\s\S]*\}", content)
        if not m:
            return {
                "action": "HOLD",
                "rationale": content.strip()[:240],
                "confidence": 0.0, "entry_price": None, "stop_loss": None, "take_profit": None,
            }
        try:
            parsed = _json.loads(m.group(0))
        except Exception:
            return {
                "action": "HOLD",
                "rationale": f"parse_failed: {content[:240]}",
                "confidence": 0.0, "entry_price": None, "stop_loss": None, "take_profit": None,
            }
        action = str(parsed.get("action") or parsed.get("decision") or "HOLD").upper()
        if action not in {"BUY", "SELL", "HOLD"}:
            action = "HOLD"
        return {
            "action": action,
            "confidence": float(parsed.get("confidence") or 0.0),
            "entry_price": parsed.get("entry_price"),
            "stop_loss":   parsed.get("stop_loss"),
            "take_profit": parsed.get("take_profit"),
            "rationale":   str(parsed.get("rationale") or "").strip()[:400],
        }
    except Exception as exc:
        logger.warning("LLM decision failed: %s", exc)
        return {
            "action": "HOLD",
            "rationale": f"LLM error: {exc}",
            "confidence": 0.0, "entry_price": None, "stop_loss": None, "take_profit": None,
        }


async def auto_pm_decision_cycle() -> dict[str, Any]:
    """Runs every 60 seconds. Picks one candidate instrument from the open
    desks only, asks the LLM whether to open a new position. Very
    conservative — macro cadence, not HFT.

    Gating cascade:
        1. concentration cap — do nothing if already at MAX_OPEN_TRADES
        2. market hours — skip closed desks entirely
        3. watchlist dedup — do not re-open a symbol we already hold
        4. LLM bias — the prompt pushes the model toward HOLD
    """
    from app.market_hours import open_desks
    open_trades = list_trades(status="OPEN")
    if len(open_trades) >= MAX_OPEN_TRADES:
        logger.info("auto_pm_decision_cycle: concentration cap (%d) hit — skipping", MAX_OPEN_TRADES)
        return {"skipped": "concentration_cap", "open_count": len(open_trades)}

    live_desks = open_desks()
    if not live_desks:
        logger.info("auto_pm_decision_cycle: all desks closed — skipping")
        return {"skipped": "all_desks_closed", "open_count": len(open_trades)}

    candidate = _pick_candidate(open_trades)
    if candidate is None:
        return {
            "skipped": "watchlist_fully_held_or_desks_closed",
            "open_count": len(open_trades),
            "open_desks": live_desks,
        }

    desk, symbol = candidate
    # Staleness-aware fetch: reject candidates whose last Yahoo tick is too
    # old — e.g. USD/INR outside Asia hours.  Mark-to-market (below) keeps
    # using the plain fetch_price so stops still fire on the last print.
    price = await asyncio.to_thread(fetch_fresh_price, desk, symbol)
    if price is None:
        return {"skipped": "stale_or_unavailable_price", "desk": desk, "symbol": symbol}

    # Compute the full technical packet (OU / Hurst / GARCH / yield slope etc.)
    from app.signal_packet import build_signal_packet
    packet = await asyncio.to_thread(build_signal_packet, desk, symbol)

    # ---- ML gate (before LLM call) ---------------------------------------
    # Once the screener is trained on >= 50 closed trades, we skip Gemma
    # entirely when P(pnl > 0) < 0.50 — that saves free-tier quota on
    # obvious losers.  If the model isn't ready yet we pass through.
    from app.ml_model import score as ml_score
    ml_result_long  = await asyncio.to_thread(ml_score, packet, "LONG")
    ml_result_short = await asyncio.to_thread(ml_score, packet, "SHORT")
    ml_prob_long  = ml_result_long.get("probability")  if ml_result_long.get("ready")  else None
    ml_prob_short = ml_result_short.get("probability") if ml_result_short.get("ready") else None
    ml_best_prob  = max([p for p in (ml_prob_long, ml_prob_short) if p is not None], default=None)
    if ml_best_prob is not None and ml_best_prob < 0.50:
        logger.info(
            "auto_pm ML_SKIP %s/%s — p_long=%.2f p_short=%.2f (both below 0.50)",
            desk, symbol, ml_prob_long or 0, ml_prob_short or 0,
        )
        return {
            "skipped": "ml_filter",
            "desk": desk, "symbol": symbol,
            "ml_probability_long": ml_prob_long,
            "ml_probability_short": ml_prob_short,
            "signal_packet": packet,
        }

    # Ask the LLM in JSON mode, carrying the packet in the prompt
    portfolio_context = {
        "open_positions_in_book": len(open_trades),
        "max_open_trades": MAX_OPEN_TRADES,
    }
    decision = await _llm_decide(desk, symbol, packet, portfolio_context)

    if decision["action"] == "HOLD":
        logger.info(
            "auto_pm HOLD %s/%s (conf %.2f) — %s",
            desk, symbol, decision.get("confidence") or 0.0,
            (decision.get("rationale") or "")[:100],
        )
        return {
            "action": "HOLD", "desk": desk, "symbol": symbol,
            "confidence": decision.get("confidence"),
            "rationale": decision.get("rationale"),
            "signal_packet": packet,
        }

    direction = "LONG" if decision["action"] == "BUY" else "SHORT"
    # Honour LLM-suggested entry price when it's within 0.5% of the live price;
    # otherwise use the live price (prevents the LLM from hallucinating levels).
    entry_px = price
    llm_entry = decision.get("entry_price")
    if isinstance(llm_entry, (int, float)) and price > 0:
        drift = abs(llm_entry - price) / price
        if drift <= 0.005:
            entry_px = float(llm_entry)

    trade = insert_trade(
        desk=desk,
        symbol=symbol,
        direction=direction,
        entry_price=entry_px,
        rationale=decision.get("rationale") or f"Auto-PM {decision['action']}",
        meta={
            "source": "auto_pm_cycle",
            "confidence": decision.get("confidence"),
            "llm_stop_loss":   decision.get("stop_loss"),
            "llm_take_profit": decision.get("take_profit"),
            "live_price_at_decision": price,
            "signal_packet": packet,
            "ml_probability_long":  ml_prob_long,
            "ml_probability_short": ml_prob_short,
        },
    )
    return {"action": decision["action"], "trade": trade, "packet_summary_keys": list(packet.keys())}
