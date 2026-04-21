"""
AISStream.io WebSocket consumer.

Maintains an in-memory registry of the most recent AIS Position Report for
every MMSI seen in the last N minutes.  The Research page reads this
registry through `/api/research/ships` and computes chokepoint counts.

Free AIS tier is at ~wss://stream.aisstream.io/v0/stream~.  Requires a free
API key from https://aisstream.io/authenticate — put it in backend/.env as
``AISSTREAM_KEY``.  Without a key the consumer is disabled and ship
endpoints return an empty list plus a helpful "add your key" message.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("hedgyyyboo.ais_stream")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AIS_WS_URL = "wss://stream.aisstream.io/v0/stream"

# Rough rectangular bounding boxes for global maritime chokepoints.
# Latitudes and longitudes are [lo_lat, lo_lon] → [hi_lat, hi_lon].
CHOKEPOINTS: dict[str, tuple[tuple[float, float], tuple[float, float], str]] = {
    "Strait of Hormuz":      ((24.0, 54.0),  (27.5, 58.0),  "Oil tankers — ~20% of world crude passes here"),
    "Suez Canal":            ((29.5, 32.2),  (32.5, 33.0),  "East-West shipping — ~12% of global trade"),
    "Panama Canal":          (( 8.5, -80.5), (10.0, -79.0), "Pacific ↔ Atlantic — ~5% of world trade"),
    "Strait of Malacca":     (( 0.5, 99.0),  ( 4.0, 104.5), "Indian Ocean → East Asia, LNG + crude"),
    "Singapore Strait":      (( 0.8, 103.0), ( 1.8, 104.5), "Southeast Asia shipping hub"),
    "English Channel/Dover": ((50.0,   0.5), (51.5,   2.0), "North-Sea approach, intra-EU traffic"),
    "Rotterdam":             ((51.8,   3.5), (52.5,   5.0), "Largest EU port, crude + containers"),
    "Bosporus":              ((40.9,  28.8), (41.3,  29.5), "Black-Sea outlet, Russian grain + oil"),
}

# How fresh a report has to be before it's considered 'live'.
MAX_AGE_MINUTES = 60


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

_ships: dict[int, dict[str, Any]] = {}
_lock = asyncio.Lock()
_task: asyncio.Task[Any] | None = None
_connected = False
_last_error: str | None = None
_key_present = False


async def _prune_loop() -> None:
    """Drop ships we haven't heard from in MAX_AGE_MINUTES."""
    cutoff_delta = timedelta(minutes=MAX_AGE_MINUTES)
    while True:
        try:
            now = datetime.now(timezone.utc)
            async with _lock:
                drop = [m for m, s in _ships.items() if (now - datetime.fromisoformat(s["updated_at"])) > cutoff_delta]
                for m in drop:
                    _ships.pop(m, None)
        except Exception as exc:
            logger.warning("ais prune: %s", exc)
        await asyncio.sleep(60)


async def _consume_stream(api_key: str) -> None:
    """Long-lived WebSocket consumer with exponential backoff on error."""
    global _connected, _last_error
    try:
        import websockets
    except Exception as exc:
        _last_error = f"websockets lib missing: {exc}"
        logger.error(_last_error)
        return

    backoff = 2.0
    while True:
        try:
            async with websockets.connect(AIS_WS_URL, ping_interval=30, max_size=2**20) as ws:
                await ws.send(json.dumps({
                    "APIKey": api_key,
                    "BoundingBoxes": [[[-90, -180], [90, 180]]],  # global
                    "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
                }))
                _connected = True
                _last_error = None
                backoff = 2.0
                logger.info("AISStream: connected and subscribed.")
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    mtype = msg.get("MessageType")
                    meta = msg.get("MetaData") or {}
                    if mtype == "PositionReport":
                        body = (msg.get("Message") or {}).get("PositionReport") or {}
                        mmsi = body.get("UserID") or meta.get("MMSI")
                        if mmsi is None:
                            continue
                        async with _lock:
                            existing = _ships.get(int(mmsi), {})
                            _ships[int(mmsi)] = {
                                **existing,
                                "mmsi": int(mmsi),
                                "lat":   body.get("Latitude"),
                                "lon":   body.get("Longitude"),
                                "speed_kn": body.get("Sog"),
                                "course":   body.get("Cog"),
                                "ship_name": (meta.get("ShipName") or existing.get("ship_name") or "").strip() or None,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }
                    elif mtype == "ShipStaticData":
                        body = (msg.get("Message") or {}).get("ShipStaticData") or {}
                        mmsi = body.get("UserID") or meta.get("MMSI")
                        if mmsi is None:
                            continue
                        async with _lock:
                            existing = _ships.get(int(mmsi), {})
                            _ships[int(mmsi)] = {
                                **existing,
                                "mmsi": int(mmsi),
                                "ship_name": (body.get("Name") or existing.get("ship_name") or "").strip() or None,
                                "ship_type": body.get("Type"),
                                "destination": (body.get("Destination") or "").strip() or None,
                                "callsign":    (body.get("CallSign")    or "").strip() or None,
                            }
        except Exception as exc:
            _connected = False
            _last_error = f"{type(exc).__name__}: {exc}"
            logger.warning("AISStream dropped (%s) — reconnecting in %.1fs", _last_error, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)


def start_background_consumer() -> bool:
    """Kick the consumer into the running event loop.  Returns True if the
    AISSTREAM_KEY was present, False otherwise."""
    global _task, _key_present
    api_key = os.getenv("AISSTREAM_KEY", "").strip()
    _key_present = bool(api_key and not api_key.startswith("your_"))
    if not _key_present:
        logger.info("AISStream: no AISSTREAM_KEY in env — marine consumer disabled.")
        return False
    try:
        loop = asyncio.get_event_loop()
        _task = loop.create_task(_consume_stream(api_key))
        loop.create_task(_prune_loop())
    except RuntimeError:
        # Called outside a running loop
        logger.warning("AISStream: no running event loop — consumer not started.")
        return False
    logger.info("AISStream: background consumer started.")
    return True


# ---------------------------------------------------------------------------
# Read APIs used by the /api/research/* endpoints
# ---------------------------------------------------------------------------

def get_status() -> dict[str, Any]:
    return {
        "key_present": _key_present,
        "connected": _connected,
        "ships_cached": len(_ships),
        "last_error": _last_error,
    }


def get_ships(limit: int = 800) -> list[dict[str, Any]]:
    with_pos = [s for s in _ships.values() if s.get("lat") is not None and s.get("lon") is not None]
    with_pos.sort(key=lambda s: s.get("updated_at") or "", reverse=True)
    return with_pos[:limit]


def get_chokepoint_counts() -> list[dict[str, Any]]:
    counts = {name: 0 for name in CHOKEPOINTS}
    samples: dict[str, list[dict[str, Any]]] = {name: [] for name in CHOKEPOINTS}
    for s in _ships.values():
        lat = s.get("lat"); lon = s.get("lon")
        if lat is None or lon is None:
            continue
        for name, ((lo_lat, lo_lon), (hi_lat, hi_lon), _) in CHOKEPOINTS.items():
            if lo_lat <= lat <= hi_lat and lo_lon <= lon <= hi_lon:
                counts[name] += 1
                if len(samples[name]) < 3:
                    samples[name].append({
                        "name": s.get("ship_name"),
                        "type": s.get("ship_type"),
                        "dest": s.get("destination"),
                    })
                break
    return [
        {
            "name": name,
            "count": counts[name],
            "description": desc,
            "bbox": {"sw": [lo_lat, lo_lon], "ne": [hi_lat, hi_lon]},
            "sample_ships": samples[name],
        }
        for name, ((lo_lat, lo_lon), (hi_lat, hi_lon), desc) in CHOKEPOINTS.items()
    ]
