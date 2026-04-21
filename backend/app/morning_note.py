"""
Hedgyyyboo Phase 4 — Autonomous Morning Note Engine.

Aggregates data from all Phase 1-3 engines, generates an LLM briefing,
and renders a Morgan Stanley-style PDF via ReportLab.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

logger = logging.getLogger("hedgyyyboo.morning_note")


# ---------------------------------------------------------------------------
# Data aggregation — pulls from all live engines
# ---------------------------------------------------------------------------


async def _aggregate_data() -> dict[str, Any]:
    """Gather data from all Phase 1-3 engines for the morning note."""
    data: dict[str, Any] = {}

    # Phase 1: PCA / LDA
    try:
        from app.data_generator import generate_market_data, generate_news_headlines
        from app.math_engine import run_pca_analysis, run_lda_analysis

        market_df = generate_market_data()
        headlines = generate_news_headlines()
        data["pca"] = run_pca_analysis(market_df)
        data["lda"] = run_lda_analysis(headlines)
    except Exception as exc:
        logger.warning("PCA/LDA aggregation failed: %s", exc)
        data["pca"] = {}
        data["lda"] = {}

    # Phase 2: Batch quotes
    try:
        from app.stock_data import get_batch_quotes

        data["quotes"] = get_batch_quotes(
            ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "JPM", "GS"]
        )
    except Exception as exc:
        logger.warning("Batch quotes failed: %s", exc)
        data["quotes"] = []

    # Phase 2: News
    try:
        from app.news_feed import fetch_news

        data["news"] = fetch_news(category="all", limit=5)
    except Exception as exc:
        logger.warning("News fetch failed: %s", exc)
        data["news"] = []

    # Phase 3: Vol surface
    try:
        from app.vol_surface import get_vol_surface

        data["vol_surface"] = await get_vol_surface("SPY")
    except Exception as exc:
        logger.warning("Vol surface failed: %s", exc)
        data["vol_surface"] = {}

    # Phase 3: Tail risk (GARCH)
    try:
        from app.garch_engine import get_tail_risk

        data["tail_risk"] = await get_tail_risk()
    except Exception as exc:
        logger.warning("Tail risk failed: %s", exc)
        data["tail_risk"] = {}

    return data


# ---------------------------------------------------------------------------
# LLM briefing generation
# ---------------------------------------------------------------------------

MORNING_NOTE_SYSTEM = (
    "You are Hedgyyyboo, generating the daily morning briefing for PM Vedant. "
    "Structure: 1) Market Overview (2 sentences), 2) Risk Assessment (2 sentences), "
    "3) Key Positions to Watch (2-3 bullet points), 4) Actionable Recommendation (1 sentence). "
    "Use specific numbers from the data. Be concise and institutional-grade."
)


async def _generate_briefing(data: dict[str, Any]) -> str:
    """Generate the LLM briefing from aggregated data."""
    from app.rag_brain import _rate_limited_llm_call

    # Build context
    parts = []

    # PCA summary
    pca = data.get("pca", {})
    interp = pca.get("interpretation", {})
    if interp:
        parts.append(
            f"PCA: Systemic risk {interp.get('systemic_risk_pct', 0):.1f}%, "
            f"Dominant sector: {interp.get('dominant_sector', 'N/A')}"
        )

    # LDA summary
    lda = data.get("lda", {})
    regime = lda.get("regime_summary", "")
    if regime:
        parts.append(f"Market regime: {regime}")
    topics = lda.get("topics", [])
    for t in topics[:3]:
        parts.append(f"Topic '{t['topic_name']}': {', '.join(t['top_words'][:4])}")

    # Quotes
    quotes = data.get("quotes", [])
    for q in quotes[:5]:
        parts.append(
            f"{q.get('ticker', '?')}: ${q.get('price', 0):.2f} ({q.get('change_pct', 0):+.2f}%)"
        )

    # Vol surface
    vol = data.get("vol_surface", {})
    skew = vol.get("skew_analysis", {})
    if skew:
        parts.append(
            f"SPY IV: Put avg {skew.get('put_iv_avg', 0):.1%}, "
            f"Call avg {skew.get('call_iv_avg', 0):.1%}, "
            f"Skew {skew.get('skew_ratio', 0):.4f}"
        )

    # Tail risk
    tail = data.get("tail_risk", {})
    risk_summary = tail.get("risk_summary", "")
    if risk_summary:
        parts.append(f"GARCH risk: {risk_summary}")

    # News
    news = data.get("news", [])
    for n in news[:3]:
        parts.append(f"Headline: {n.get('title', 'N/A')}")

    context = "\n".join(parts)
    user_prompt = (
        f"Today's date: {datetime.now(tz=timezone.utc).strftime('%B %d, %Y')}\n\n"
        f"Data snapshot:\n{context}\n\n"
        f"Generate the morning briefing."
    )

    return await _rate_limited_llm_call(MORNING_NOTE_SYSTEM, user_prompt, max_tokens=600)


# ---------------------------------------------------------------------------
# PDF generation via ReportLab (Morgan Stanley style)
# ---------------------------------------------------------------------------


def _build_pdf(briefing: str, data: dict[str, Any]) -> bytes:
    """Render a Morgan Stanley-style PDF morning note."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "NoteTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#0A1628"),
        spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "NoteSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=12,
        fontName="Helvetica",
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#1E3A5F"),
        spaceBefore=14,
        spaceAfter=6,
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "NoteBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#1A1A2E"),
        leading=14,
        spaceAfter=8,
        fontName="Helvetica",
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=7,
        textColor=colors.HexColor("#94A3B8"),
        leading=9,
        fontName="Helvetica",
    )

    elements = []

    # Header
    now = datetime.now(tz=timezone.utc)
    elements.append(Paragraph("HEDGYYYBOO", title_style))
    elements.append(
        Paragraph(
            f"Daily Morning Note &mdash; {now.strftime('%B %d, %Y')} | Generated {now.strftime('%H:%M UTC')}",
            subtitle_style,
        )
    )
    elements.append(
        HRFlowable(
            width="100%", thickness=2, color=colors.HexColor("#00E5A0"), spaceAfter=12
        )
    )

    # Market snapshot table
    quotes = data.get("quotes", [])
    if quotes:
        elements.append(Paragraph("MARKET SNAPSHOT", section_style))
        table_data = [["Ticker", "Price", "Change %", "Volume"]]
        for q in quotes[:8]:
            chg = q.get("change_pct", 0)
            chg_str = f"{chg:+.2f}%"
            table_data.append([
                q.get("ticker", "?"),
                f"${q.get('price', 0):.2f}",
                chg_str,
                f"{q.get('volume', 0):,.0f}",
            ])

        t = Table(table_data, colWidths=[80, 80, 80, 100])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A1628")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))

    # Risk metrics
    tail = data.get("tail_risk", {})
    pca = data.get("pca", {})
    interp = pca.get("interpretation", {})
    if interp or tail:
        elements.append(Paragraph("RISK METRICS", section_style))
        if interp:
            elements.append(Paragraph(
                f"Systemic Risk: {interp.get('systemic_risk_pct', 0):.1f}% | "
                f"Idiosyncratic: {interp.get('idiosyncratic_risk_pct', 0):.1f}% | "
                f"Dominant Sector: {interp.get('dominant_sector', 'N/A')}",
                body_style,
            ))
        risk_summary = tail.get("risk_summary", "")
        if risk_summary:
            elements.append(Paragraph(f"GARCH: {risk_summary}", body_style))

    # Vol surface
    vol = data.get("vol_surface", {})
    skew = vol.get("skew_analysis", {})
    if skew:
        elements.append(Paragraph("VOLATILITY SURFACE", section_style))
        elements.append(Paragraph(
            f"SPY Spot: ${vol.get('spot_price', 0):.2f} | "
            f"Put IV: {skew.get('put_iv_avg', 0):.1%} | "
            f"Call IV: {skew.get('call_iv_avg', 0):.1%} | "
            f"Skew Ratio: {skew.get('skew_ratio', 0):.4f}",
            body_style,
        ))

    # LLM briefing
    elements.append(Paragraph("PM BRIEFING", section_style))
    # Split briefing into paragraphs
    for para in briefing.split("\n"):
        para = para.strip()
        if para:
            # Escape HTML-special chars for ReportLab
            para = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            elements.append(Paragraph(para, body_style))

    # News
    news = data.get("news", [])
    if news:
        elements.append(Paragraph("TOP HEADLINES", section_style))
        for n in news[:5]:
            title = n.get("title", "N/A")
            title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            elements.append(Paragraph(f"&bull; {title}", body_style))

    # Footer / disclaimer
    elements.append(Spacer(1, 20))
    elements.append(
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"))
    )
    elements.append(Paragraph(
        "HEDGYYYBOO RESEARCH TERMINAL | For internal use only. "
        "This report is auto-generated from live market data and quantitative models. "
        "Not investment advice. All data subject to market conditions.",
        disclaimer_style,
    ))

    doc.build(elements)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_morning_note() -> dict[str, Any]:
    """Full pipeline: aggregate → LLM briefing → PDF."""
    logger.info("Starting morning note generation...")

    data = await _aggregate_data()
    briefing = await _generate_briefing(data)
    pdf_bytes = _build_pdf(briefing, data)

    logger.info("Morning note generated: %d bytes PDF", len(pdf_bytes))

    return {
        "briefing": briefing,
        "pdf_bytes": pdf_bytes,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "data_sources": list(data.keys()),
    }
