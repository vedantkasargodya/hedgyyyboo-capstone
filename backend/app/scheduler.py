"""
Hedgyyyboo Phase 4 — APScheduler Morning Note Cron.

Runs the morning note pipeline at 08:00 AM IST (Asia/Calcutta) daily.
The generated PDF is saved to disk and the briefing is logged.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("hedgyyyboo.scheduler")

_scheduler: AsyncIOScheduler | None = None

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "morning_notes")


async def _run_morning_note():
    """Execute the morning note pipeline, save PDF, and update the global cache."""
    logger.info("=== MORNING NOTE CRON TRIGGERED ===")
    try:
        import base64
        from app.morning_note import generate_morning_note

        result = await generate_morning_note()

        # Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        # Save PDF
        date_str = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        pdf_path = os.path.join(OUTPUT_DIR, f"morning_note_{date_str}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(result["pdf_bytes"])

        logger.info("Morning note saved: %s (%d bytes)", pdf_path, len(result["pdf_bytes"]))
        logger.info("Briefing:\n%s", result["briefing"])

        # Update the global cache in main.py
        try:
            from app import main as main_module
            pdf_b64 = base64.b64encode(result["pdf_bytes"]).decode("utf-8")
            main_module._morning_note_cache = {
                "status": "ok",
                "briefing": result["briefing"],
                "pdf_base64": pdf_b64,
                "generated_at": result["generated_at"],
                "data_sources": result["data_sources"],
            }
            logger.info("Morning note cache updated from scheduler.")
        except Exception as cache_exc:
            logger.warning("Failed to update morning note cache: %s", cache_exc)

    except Exception as exc:
        logger.error("Morning note cron failed: %s", exc, exc_info=True)


def start_scheduler():
    """Start the APScheduler with the morning note cron job."""
    global _scheduler

    if _scheduler is not None:
        logger.info("Scheduler already running")
        return

    _scheduler = AsyncIOScheduler(timezone="Asia/Calcutta")

    # Daily at 08:00 IST
    _scheduler.add_job(
        _run_morning_note,
        "cron",
        hour=8,
        minute=0,
        id="morning_note",
        name="Daily Morning Note",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("APScheduler started — morning note cron at 08:00 IST daily")


def stop_scheduler():
    """Stop the APScheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")
