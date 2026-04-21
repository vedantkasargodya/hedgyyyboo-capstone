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
    CLOSE_STOP_LOSS, CLOSE_TAKE_PROFIT, CLOSE_TIME_STOP,
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
    yf_sym = _yf_symbol(desk, symbol)
    if yf_sym is None:
        return None
    try:
        # A 2-day intraday pull gives us the most recent trade price; Yahoo
        # doesn't serve a true real-time quote on the free endpoint.
        hist = yf.Ticker(yf_sym).history(period="2d", interval="1m")
        if hist is not None and not hist.empty:
            return float(hist["Close"].iloc[-1])
        daily = yf.Ticker(yf_sym).history(period="5d")
        if daily is not None and not daily.empty:
            return float(daily["Close"].iloc[-1])
    except Exception as exc:                                       # pragma: no cover
        logger.warning("price fetch failed for %s/%s: %s", desk, symbol, exc)
    return None


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


def evaluate_close_rules(trade: dict[str, Any]) -> str | None:
    """Return a CLOSE_* reason if any rule fires for this trade, else None."""
    desk  = trade["desk"]
    rules = DESK_RULES.get(desk, DESK_RULES[DESK_FX])
    pnl   = trade.get("pnl_pct") or 0.0

    if pnl <= rules["stop_loss_pct"]:
        return CLOSE_STOP_LOSS
    if pnl >= rules["take_profit_pct"]:
        return CLOSE_TAKE_PROFIT

    held = _days_held(trade.get("opened_at"))
    if held >= rules["max_hold_days"]:
        return CLOSE_TIME_STOP

    # Time stop variant: 3+ days with <0.5% progress means regime is wrong.
    if held >= 3.0 and pnl < 0.5:
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
FX_WATCHLIST     = ["EUR/USD", "USD/JPY", "GBP/USD", "USD/INR", "AUD/USD"]
EQUITY_WATCHLIST = ["AAPL", "MSFT", "GOOGL", "NVDA", "META", "TSLA", "JPM"]
RATES_WATCHLIST  = ["UST10Y", "UST5Y", "UST30Y"]


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


async def _llm_decide(desk: str, symbol: str, context: dict[str, Any]) -> dict[str, Any]:
    """Ask Gemma-3n for a BUY / SELL / HOLD + a 1-2 sentence rationale.
    Falls back to HOLD if the LLM call fails."""
    try:
        import os, httpx
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        if not api_key or api_key.startswith("your_"):
            return {"decision": "HOLD", "rationale": "No OpenRouter key; skipping."}

        prompt = (
            "You are a conservative macro portfolio manager at Hedgyyyboo. "
            "You manage a small book with strict risk limits. "
            "Decide whether to open a position RIGHT NOW on the instrument "
            "described below. Respond in JSON with exactly two keys: "
            "`decision` ∈ {BUY, SELL, HOLD} and `rationale` (one sentence).\n\n"
            f"Desk: {desk}\nSymbol: {symbol}\nContext: {context}\n"
        )
        payload = {
            "model": "google/gemma-3n-e4b-it:free",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        if resp.status_code != 200:
            return {"decision": "HOLD", "rationale": f"LLM {resp.status_code}"}
        content = resp.json()["choices"][0]["message"]["content"]
        import json as _json, re
        m = re.search(r"\{[^{}]+\}", content, re.S)
        if not m:
            return {"decision": "HOLD", "rationale": content.strip()[:160]}
        parsed = _json.loads(m.group(0))
        decision = (parsed.get("decision") or "HOLD").upper()
        if decision not in {"BUY", "SELL", "HOLD"}:
            decision = "HOLD"
        rationale = str(parsed.get("rationale") or "").strip()[:240]
        return {"decision": decision, "rationale": rationale}
    except Exception as exc:                                      # pragma: no cover
        logger.warning("LLM decision failed: %s", exc)
        return {"decision": "HOLD", "rationale": f"LLM error: {exc}"}


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
    price = await asyncio.to_thread(fetch_price, desk, symbol)
    if price is None:
        return {"skipped": "price_unavailable", "desk": desk, "symbol": symbol}

    context = {"last_price": price, "open_positions_across_book": len(open_trades)}
    decision = await _llm_decide(desk, symbol, context)
    if decision["decision"] == "HOLD":
        logger.info("auto_pm_decision_cycle: HOLD on %s/%s — %s", desk, symbol, decision["rationale"][:80])
        return {"action": "HOLD", "desk": desk, "symbol": symbol, "rationale": decision["rationale"]}

    direction = "LONG" if decision["decision"] == "BUY" else "SHORT"
    trade = insert_trade(
        desk=desk,
        symbol=symbol,
        direction=direction,
        entry_price=price,
        rationale=decision["rationale"] or f"Auto-PM {decision['decision']}",
        meta={"source": "auto_pm_cycle"},
    )
    return {"action": decision["decision"], "trade": trade}
