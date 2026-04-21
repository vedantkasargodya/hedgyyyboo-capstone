"""
Market-hours gating.

The auto-PM cycle must not open new positions on a closed desk.  yfinance
keeps returning the last-print price after hours, which would make the
auto-PM open a position 'at the last close' and then sit on it until the
market reopens — bad UX and not how macro desks behave.

Close rules (stop-loss / take-profit / time-stop) are NOT gated here — if
the last price already implies a stopped-out position, we close it so the
PnL is locked in rather than drifting overnight.

Times follow America/New_York (handles DST automatically via zoneinfo).
"""
from __future__ import annotations

from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from app.paper_trades_model import DESK_EQUITY, DESK_FX, DESK_RATES

NY = ZoneInfo("America/New_York")


def _ny_now(now: datetime | None = None) -> datetime:
    if now is None:
        now = datetime.now(tz=ZoneInfo("UTC"))
    return now.astimezone(NY)


def is_desk_open(desk: str, now: datetime | None = None) -> bool:
    ny = _ny_now(now)
    weekday = ny.weekday()      # Monday=0 .. Sunday=6
    t = ny.time()

    if desk == DESK_FX:
        # Spot FX: Sunday 17:00 ET open → Friday 17:00 ET close
        if weekday == 5:                              # Saturday — closed all day
            return False
        if weekday == 6:                              # Sunday — open after 17:00 ET
            return t >= time(17, 0)
        if weekday == 4:                              # Friday — closed after 17:00 ET
            return t < time(17, 0)
        return True                                   # Mon–Thu — 24 h
    if desk == DESK_EQUITY:
        # NYSE / NASDAQ regular session (ignore pre-/post-market)
        if weekday >= 5:
            return False
        return time(9, 30) <= t < time(16, 0)
    if desk == DESK_RATES:
        # Cash Treasury market — roughly 08:00–17:00 ET on weekdays
        if weekday >= 5:
            return False
        return time(8, 0) <= t < time(17, 0)
    return False


def desk_status() -> dict[str, Any]:
    """Return a serialisable snapshot used by the UI banner / diagnostics."""
    ny = _ny_now()
    return {
        "as_of_utc": datetime.utcnow().isoformat() + "Z",
        "as_of_ny": ny.isoformat(),
        "desks": {
            DESK_FX:     {"open": is_desk_open(DESK_FX, ny),
                          "rule": "Sun 17:00 ET → Fri 17:00 ET (24x5)"},
            DESK_EQUITY: {"open": is_desk_open(DESK_EQUITY, ny),
                          "rule": "Mon–Fri 09:30–16:00 ET (NYSE regular)"},
            DESK_RATES:  {"open": is_desk_open(DESK_RATES, ny),
                          "rule": "Mon–Fri 08:00–17:00 ET (cash UST)"},
        },
    }


def open_desks() -> list[str]:
    """List of currently tradeable desks."""
    return [d for d, s in desk_status()["desks"].items() if s["open"]]
