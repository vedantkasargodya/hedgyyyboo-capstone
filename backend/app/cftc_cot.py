"""
Hedgyyyboo Phase 6 — CFTC Commitments of Traders (COT) Data.

Pulls weekly positioning data from the CFTC to show:
- Net speculative (non-commercial) positions for major FX futures
- Whether hedge funds are net-long or net-short
- Position changes week-over-week
- Extreme positioning signals (crowded trades)

Source: CFTC Commitment of Traders reports via Quandl/Nasdaq Data Link.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pandas as pd
import requests

logger = logging.getLogger("hedgyyyboo.cftc_cot")

# ---------------------------------------------------------------------------
# CFTC COT Contract IDs for FX Futures (CME)
# ---------------------------------------------------------------------------

# Map FX pairs to CFTC report commodity codes
# Source: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
COT_CONTRACTS = {
    "EUR/USD": {"code": "099741", "name": "EURO FX", "cme_symbol": "6E"},
    "USD/JPY": {"code": "097741", "name": "JAPANESE YEN", "cme_symbol": "6J"},
    "GBP/USD": {"code": "096742", "name": "BRITISH POUND", "cme_symbol": "6B"},
    "AUD/USD": {"code": "232741", "name": "AUSTRALIAN DOLLAR", "cme_symbol": "6A"},
    "USD/CHF": {"code": "092741", "name": "SWISS FRANC", "cme_symbol": "6S"},
    "USD/CAD": {"code": "090741", "name": "CANADIAN DOLLAR", "cme_symbol": "6C"},
}

# CFTC disaggregated futures-only report (JSON endpoint)
CFTC_API_URL = "https://publicreporting.cftc.gov/resource/jun7-fc8e.json"


def fetch_cot_data() -> dict[str, Any]:
    """Fetch latest CFTC Commitments of Traders data for FX futures.

    Uses the CFTC's Socrata Open Data API (no key required for public data).
    Pulls the Disaggregated Futures-Only report.
    """
    t_start = datetime.now()
    results = []
    errors = []

    for pair, info in COT_CONTRACTS.items():
        try:
            # Query CFTC API - get last 4 weeks for the specific contract
            params = {
                "$where": f"cftc_contract_market_code='{info['code']}'",
                "$order": "report_date_as_yyyy_mm_dd DESC",
                "$limit": 4,
            }

            resp = requests.get(CFTC_API_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            if not data:
                # Fallback: try legacy futures-only report
                legacy_url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"
                params_legacy = {
                    "$where": f"cftc_contract_market_code='{info['code']}'",
                    "$order": "report_date_as_yyyy_mm_dd DESC",
                    "$limit": 4,
                }
                resp = requests.get(legacy_url, params=params_legacy, timeout=15)
                resp.raise_for_status()
                data = resp.json()

            if not data:
                errors.append(f"{pair}: no data returned")
                continue

            latest = data[0]
            prior = data[1] if len(data) > 1 else None

            # Extract non-commercial (speculative) positions
            nc_long = int(latest.get("noncomm_positions_long_all", 0))
            nc_short = int(latest.get("noncomm_positions_short_all", 0))
            net_position = nc_long - nc_short

            # Commercial (hedger) positions
            comm_long = int(latest.get("comm_positions_long_all", 0))
            comm_short = int(latest.get("comm_positions_short_all", 0))
            comm_net = comm_long - comm_short

            # Open interest
            oi = int(latest.get("open_interest_all", 0))

            # Net position as % of open interest (crowding indicator)
            net_pct_oi = round(net_position / oi * 100, 2) if oi > 0 else 0

            # Week-over-week change
            wow_change = 0
            if prior:
                prior_nc_long = int(prior.get("noncomm_positions_long_all", 0))
                prior_nc_short = int(prior.get("noncomm_positions_short_all", 0))
                prior_net = prior_nc_long - prior_nc_short
                wow_change = net_position - prior_net

            # Extreme positioning signal
            # >30% of OI is one side = crowded trade
            signal = "NEUTRAL"
            if net_pct_oi > 25:
                signal = "EXTREME LONG"
            elif net_pct_oi > 15:
                signal = "NET LONG"
            elif net_pct_oi < -25:
                signal = "EXTREME SHORT"
            elif net_pct_oi < -15:
                signal = "NET SHORT"

            report_date = latest.get("report_date_as_yyyy_mm_dd", "")

            results.append({
                "pair": pair,
                "contract_name": info["name"],
                "cme_symbol": info["cme_symbol"],
                "report_date": report_date,
                "noncommercial_long": nc_long,
                "noncommercial_short": nc_short,
                "net_speculative": net_position,
                "commercial_long": comm_long,
                "commercial_short": comm_short,
                "commercial_net": comm_net,
                "open_interest": oi,
                "net_pct_of_oi": net_pct_oi,
                "wow_change": wow_change,
                "positioning_signal": signal,
            })

            logger.info(
                "COT %s: net_spec=%+d (%+.1f%% OI) wow_chg=%+d signal=%s",
                pair, net_position, net_pct_oi, wow_change, signal,
            )

        except Exception as exc:
            logger.warning("COT fetch failed for %s: %s", pair, exc)
            errors.append(f"{pair}: {exc}")

    # Aggregate signal
    total_net = sum(r["net_speculative"] for r in results)
    usd_bias = "USD WEAK" if total_net > 0 else "USD STRONG" if total_net < 0 else "NEUTRAL"

    return {
        "status": "ok",
        "source": "CFTC Commitments of Traders",
        "contracts": results,
        "contract_count": len(results),
        "aggregate_net_speculative": total_net,
        "usd_bias": usd_bias,
        "errors": errors,
        "fetched_at": t_start.isoformat(),
    }
