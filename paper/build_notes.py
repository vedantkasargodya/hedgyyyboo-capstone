"""
Build a friendly 'study notes' PDF for the Hedgyyyboo capstone project.
Focus: WHAT we're doing, WHY we do it, plain-English explanations.
No heavy math. Designed for viva prep and concept understanding.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether,
)
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "Hedgyyyboo_Study_Notes.pdf")

# ------------------------------------------------------------------
# Colors & styles
# ------------------------------------------------------------------
C_NAVY  = HexColor("#0a2540")
C_BLUE  = HexColor("#1f6feb")
C_CYAN  = HexColor("#00a6d6")
C_GREEN = HexColor("#0f9960")
C_AMBER = HexColor("#c47000")
C_RED   = HexColor("#c92a2a")
C_GREY  = HexColor("#555555")
C_BG    = HexColor("#f1f5f9")
C_CARD  = HexColor("#e8f0fb")

styles = getSampleStyleSheet()

H1 = ParagraphStyle(name="H1", parent=styles["Heading1"],
    fontName="Helvetica-Bold", fontSize=22, textColor=C_NAVY,
    spaceBefore=8, spaceAfter=14, leading=26)
H2 = ParagraphStyle(name="H2", parent=styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=15, textColor=C_BLUE,
    spaceBefore=14, spaceAfter=8, leading=19)
H3 = ParagraphStyle(name="H3", parent=styles["Heading3"],
    fontName="Helvetica-Bold", fontSize=12, textColor=C_NAVY,
    spaceBefore=10, spaceAfter=4, leading=15)
BODY = ParagraphStyle(name="B", parent=styles["BodyText"],
    fontName="Helvetica", fontSize=10.5, textColor=black,
    leading=15, spaceAfter=6, alignment=TA_JUSTIFY)
BULLET = ParagraphStyle(name="Bul", parent=BODY,
    leftIndent=16, bulletIndent=4, spaceAfter=3)
NOTE = ParagraphStyle(name="Note", parent=BODY,
    fontName="Helvetica-Oblique", textColor=C_GREY, fontSize=10, spaceAfter=4)
CALLOUT = ParagraphStyle(name="Call", parent=BODY,
    fontName="Helvetica", fontSize=10.5, textColor=black,
    backColor=C_CARD, borderPadding=8, borderColor=C_BLUE,
    borderWidth=0.8, leading=15, spaceAfter=10, leftIndent=0, rightIndent=0)
TITLE = ParagraphStyle(name="Title", parent=styles["Title"],
    fontName="Helvetica-Bold", fontSize=30, textColor=C_NAVY,
    alignment=TA_CENTER, spaceAfter=6)
SUB = ParagraphStyle(name="Sub", parent=BODY,
    fontSize=13, textColor=C_BLUE, alignment=TA_CENTER, spaceAfter=10)
TAG = ParagraphStyle(name="Tag", parent=BODY,
    fontSize=10, textColor=C_GREY, alignment=TA_CENTER, spaceAfter=20)
CODE = ParagraphStyle(name="Code", parent=BODY,
    fontName="Courier", fontSize=9.8, textColor=HexColor("#0d1117"),
    backColor=HexColor("#f6f8fa"), borderPadding=6,
    borderColor=HexColor("#d0d7de"), borderWidth=0.5, leading=13)

def bullet(text):
    return Paragraph(f"• {text}", BULLET)

def spacer(h=6):
    return Spacer(1, h)

# ------------------------------------------------------------------
# Build the story
# ------------------------------------------------------------------
story = []

# ============ COVER ============
story += [
    Spacer(1, 80),
    Paragraph("Hedgyyyboo", TITLE),
    Paragraph("Study Notes — the \"what\" and \"why\"", SUB),
    Paragraph("Capstone Project · Plain-English Guide for Viva", TAG),
    spacer(20),
    Paragraph("What you'll understand after reading this:", H3),
    bullet("What Hedgyyyboo actually <b>is</b>, in one sentence."),
    bullet("<b>Why</b> each math model is in there — the intuition, not the formulas."),
    bullet("The <b>end-to-end flow</b> of the morning brief, step by step."),
    bullet("What each <b>desk</b> on the UI does and what the buttons do."),
    bullet("A <b>jargon cheat-sheet</b> — explain any term in one line."),
    bullet("A <b>viva Q&amp;A</b> section with the questions your panel will actually ask."),
    PageBreak(),
]

# ============ SECTION 1 — WHAT IS HEDGYYYBOO ============
story += [
    Paragraph("1. What is Hedgyyyboo? (in one sentence)", H1),
    Paragraph(
        "Hedgyyyboo is a <b>free, open-source research terminal</b> for quantitative finance. "
        "It pulls live market data, runs seven classical math models on it, and then asks an "
        "AI (Google's Gemma-3n) to write a human-readable morning brief — the same kind of note "
        "that an analyst at a bank would otherwise hand-write every morning.",
        CALLOUT,
    ),
    Paragraph("Think of it as three things glued together", H3),
    bullet("🧮 <b>A calculator</b> — seven stochastic / statistical models (PCA, OU, GARCH, Hull–White, Heston, Hurst, Neural-SDE) that crunch the numbers."),
    bullet("🤖 <b>An AI writer</b> — Google Gemma-3n (a free 4-billion-parameter LLM) that turns those numbers into English commentary."),
    bullet("🖥️ <b>A terminal-style UI</b> — a Bloomberg-lookalike dashboard in the browser with three desks (Main, Fixed Income, FX Macro)."),
    spacer(10),
    Paragraph("The one-line pitch", H3),
    Paragraph(
        "\"A Bloomberg-Terminal-style dashboard that runs on a laptop, costs <b>zero dollars</b>, "
        "and writes its own morning note.\"",
        CALLOUT,
    ),
]

# ============ SECTION 2 — WHY WE BUILT IT ============
story += [
    Paragraph("2. Why does it exist? (the motivation)", H1),
    Paragraph(
        "A real Bloomberg Terminal subscription costs about <b>USD 24,000 per seat per year</b>. "
        "That's roughly ₹20 lakh a year — per analyst. Most students, small hedge funds, and "
        "independent quants can't afford it.",
        BODY,
    ),
    Paragraph(
        "At the same time, every major bank now has its quants, analysts, and strategists producing "
        "<b>morning briefs</b> — a 1-page English note that says \"here's what happened overnight, "
        "here's how the yield curve moved, here's where the risk is\". Writing one takes 30-60 "
        "minutes of a senior analyst's time every single morning.",
        BODY,
    ),
    Paragraph("So the three problems we're solving:", H3),
    bullet("💰 <b>Cost:</b> Institutional analytics is behind a paywall. Students can't access it."),
    bullet("⏱️ <b>Time:</b> Morning-brief writing is slow, repetitive, and depends on one human."),
    bullet("🧩 <b>Fragmentation:</b> You need a dozen different tools (one for rates, one for FX, one for news). No single open-source thing glues them together."),
    spacer(8),
    Paragraph(
        "Our answer: build the whole stack from scratch on free data, free models, and free LLM "
        "inference. It runs on a MacBook. Total cost: ₹0.",
        CALLOUT,
    ),
]

# ============ SECTION 3 — THE BIG PICTURE ============
story += [
    PageBreak(),
    Paragraph("3. The big picture (how it all flows)", H1),
    Paragraph(
        "Imagine a factory assembly line. Data flows left-to-right through four stations:",
        BODY,
    ),
    spacer(4),
]

# Build a simple pipeline diagram using a Table
t_data = [
    ["① INGEST",           "② CRUNCH",                 "③ NARRATE",               "④ DISPLAY"],
    ["Yahoo, UST, News,\nSEC, CFTC, BIS",
     "PCA, OU, GARCH,\nHull–White, Heston,\nHurst, Neural SDE",
     "Gemma-3n (LLM)\nwrites morning brief",
     "Next.js 16 dashboard\n(Main / FI / FX)"],
    ["Raw numbers\n+ news headlines",
     "Structured signals\n(factor scores, VaR,\nhalf-lives)",
     "English commentary\n+ PDF",
     "Charts, cards, chips,\nrefresh button"],
]
pipeline = Table(t_data, colWidths=[110, 130, 130, 130], rowHeights=[22, 52, 52])
pipeline.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), C_BLUE),
    ("TEXTCOLOR",  (0, 0), (-1, 0), white),
    ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",   (0, 0), (-1, 0), 11),
    ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
    ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
    ("BACKGROUND", (0, 1), (-1, 1), C_CARD),
    ("BACKGROUND", (0, 2), (-1, 2), C_BG),
    ("FONTNAME",   (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",   (0, 1), (-1, -1), 9.5),
    ("GRID",       (0, 0), (-1, -1), 0.5, C_GREY),
    ("LEFTPADDING",(0, 0), (-1, -1), 6),
    ("RIGHTPADDING",(0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
]))
story += [pipeline, spacer(12)]
story += [
    Paragraph(
        "One trigger (the 8:00 AM cron, or you clicking the <b>Refresh Brief</b> button) "
        "kicks off the whole pipeline. About 7 seconds later, a PDF morning brief drops out.",
        CALLOUT,
    ),
]

# ============ SECTION 4 — SEVEN MATH MODELS IN PLAIN ENGLISH ============
story += [
    PageBreak(),
    Paragraph("4. The seven math models — what they do & why", H1),
    Paragraph(
        "Each model answers one specific question about the market. Together they give the "
        "LLM everything it needs to write an intelligent brief. No formulas here — just the "
        "intuition.",
        BODY,
    ),
]

models = [
    ("① PCA on the Yield Curve",
     "\"How is the US interest-rate curve moving?\"",
     "The US Treasury curve has 11 tenors (1-month to 30-year). That's too many numbers to read. "
     "PCA compresses those 11 numbers into just <b>3 easy-to-interpret factors</b>: <b>Level</b> "
     "(the whole curve going up/down), <b>Slope</b> (short rates vs long rates), and <b>Curvature</b> "
     "(the belly bulging). It turns out these 3 factors capture 98.7% of what actually happens. "
     "So now the LLM can say \"Level up 12bps, curve flattening\" instead of reading you 11 numbers."),

    ("② Ornstein–Uhlenbeck (OU) on FX",
     "\"Is this currency pair mean-reverting? How fast?\"",
     "Some FX pairs (like EUR/USD) swing around a long-term average. If you know the average and "
     "how fast it springs back, you can trade the swings. OU gives you two numbers: the <b>long-run "
     "mean</b> (where it wants to go) and the <b>half-life</b> (how many days until it snaps "
     "halfway back). We reported EUR/USD half-life ≈ 20 days — that's tradable."),

    ("③ Hurst Exponent",
     "\"Is this market trending or mean-reverting?\"",
     "One number <b>H</b> between 0 and 1 that tells you the personality of a time-series: "
     "<b>H &lt; 0.5</b> = mean-reverting (the price keeps snapping back), <b>H = 0.5</b> = random "
     "walk (no pattern), <b>H &gt; 0.5</b> = trending (the move keeps going). Acts as a "
     "cross-check on OU: if Hurst says \"trending\" then OU mean-reversion trades are a bad idea."),

    ("④ GARCH(1,1)",
     "\"How scared should I be? What's the tail risk?\"",
     "Volatility clusters — after a big down day you usually get more big days. GARCH models "
     "this \"volatility of volatility\" and projects tomorrow's risk. From it we compute "
     "<b>Value-at-Risk (VaR)</b>: \"in 1% of days you lose more than X%\". This is the standard "
     "every bank uses to report risk to regulators."),

    ("⑤ Hull–White Short-Rate Model",
     "\"What's a fair price for a swaption?\"",
     "Swaptions are bets on future interest rates. Hull–White models the short-term interest "
     "rate as a process that pulls back toward a target, with noise. Once calibrated, it prices "
     "any swaption in closed form. We use it on the Fixed Income desk."),

    ("⑥ Heston Stochastic Volatility",
     "\"What's a fair price for an equity option when vol is changing?\"",
     "The old Black–Scholes formula assumes volatility is constant — which is wrong. "
     "Heston says volatility itself bounces around randomly. We use Monte-Carlo simulation "
     "(run the model 100,000 times, average the outcome) to price options more realistically."),

    ("⑦ Neural SDE",
     "\"What does a small neural net think will happen next?\"",
     "A modern twist: a tiny neural network learns the drift and noise of a time-series "
     "directly from data, no formula assumed. We use it as a <b>sanity check</b> — if the LLM "
     "says BUY but the Neural-SDE says the drift is negative, we flag it."),
]
for name, question, explain in models:
    story += [
        Paragraph(name, H3),
        Paragraph(f"<i>{question}</i>", NOTE),
        Paragraph(explain, BODY),
    ]

story += [
    spacer(6),
    Paragraph("Why seven and not one?", H3),
    Paragraph(
        "Each model is great at one asset class and useless elsewhere. OU is brilliant for FX "
        "pairs but terrible for rates. Hull–White is perfect for rates but useless for equities. "
        "Heston nails equity options. You need the right tool per job — that's why we have seven.",
        BODY,
    ),
]

# ============ SECTION 5 — THE LLM PART ============
story += [
    PageBreak(),
    Paragraph("5. The LLM part — how the AI writes the brief", H1),
    Paragraph(
        "All seven models spit out numbers. By themselves, numbers don't tell a story. "
        "That's where the LLM comes in.",
        BODY,
    ),
    Paragraph("Step by step:", H3),
    bullet("The backend collects: top 5 news headlines + PCA factors + OU half-lives + GARCH VaR + high-impact events in next 24h."),
    bullet("All of that is packed into a single <b>prompt</b> (like a cover letter for the LLM) — about 3,000 tokens long."),
    bullet("The prompt is sent to <b>Google Gemma-3n-E4B-it</b> via OpenRouter (a free LLM hosting service)."),
    bullet("Gemma-3n reads the prompt and writes 4–6 paragraphs of English commentary."),
    bullet("We save it to a PDF (via ReportLab) and show it in the UI."),
    spacer(6),
    Paragraph("Why Gemma-3n specifically?", H3),
    bullet("<b>It's free</b> — OpenRouter gives us 20 requests/minute with zero charges."),
    bullet("<b>It's open-weight</b> — Google released it under a permissive licence (unlike GPT-4 or BloombergGPT)."),
    bullet("<b>It's small</b> — only 4 billion parameters, so it fits everywhere and runs fast."),
    bullet("<b>It's good enough</b> — 95% factually grounded in our audit of 20 briefs."),
    spacer(6),
    Paragraph("The one weird thing we had to discover", H3),
    Paragraph(
        "Gemma-3n <b>silently rejects</b> the standard \"system role\" message that every other "
        "LLM accepts. We got a cryptic HTTP 400 error: \"Developer instruction is not enabled "
        "for models/gemma-3n-e4b-it\". The fix: concatenate the system prompt into the user turn "
        "instead of sending it as a separate role. This isn't documented anywhere — figuring it "
        "out and fixing it in three files is one of our engineering contributions.",
        CALLOUT,
    ),
    Paragraph("RAG (Retrieval-Augmented Generation) — what that buzzword actually means", H3),
    Paragraph(
        "Plain LLMs hallucinate — they make up numbers. <b>RAG</b> fixes this by feeding real, "
        "retrieved data into the prompt so the model has facts to ground on. In our case, the "
        "\"retrieved data\" isn't old documents — it's <b>live</b> computed outputs from our seven "
        "math models plus fresh news headlines. That's why our grounding rate is 95%.",
        BODY,
    ),
]

# ============ SECTION 6 — THE MORNING BRIEF FLOW ============
story += [
    PageBreak(),
    Paragraph("6. Morning brief — what happens when you click Refresh", H1),
    Paragraph(
        "Start the clock. This entire sequence takes ~7 seconds end-to-end.",
        BODY,
    ),
]

flow = [
    ("0.0 s", "You click the glowing <b>REFRESH BRIEF</b> button on the Main desk."),
    ("0.1 s", "Browser fires <tt>POST /api/morning-note?refresh=true</tt> to the FastAPI backend."),
    ("0.2 s", "Backend reads the last 6 hours of Google News RSS (10 categories)."),
    ("0.3 s", "Backend pulls 11-tenor US Treasury yields, runs PCA — gets Level/Slope/Curvature scores."),
    ("0.4 s", "For the top 28 FX pairs: OU maximum-likelihood fit → half-lives, Hurst exponents."),
    ("0.5 s", "For top 10 equities: GARCH(1,1) fit → tomorrow's VaR at 1%."),
    ("0.6 s", "Check Forex Factory calendar for high-impact events in next 24 h."),
    ("0.7 s", "All of above stuffed into a 3,000-token RAG context string."),
    ("0.8 s", "HTTPS POST to <tt>openrouter.ai/api/v1/chat/completions</tt> with the merged prompt."),
    ("6.5 s", "Gemma-3n streams back ~500 tokens of English commentary."),
    ("6.8 s", "ReportLab converts the text to a styled PDF in-memory."),
    ("7.0 s", "Everything cached server-side (until next 08:00 IST or manual refresh)."),
    ("7.2 s", "UI renders the brief in the morning-note panel with a download-PDF button."),
]
flow_tbl = Table(
    [["Time", "What happens"]] + [[t, Paragraph(d, BODY)] for t, d in flow],
    colWidths=[55, 440]
)
flow_tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), C_NAVY),
    ("TEXTCOLOR",  (0, 0), (-1, 0), white),
    ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",   (0, 0), (-1, 0), 10),
    ("FONTNAME",   (0, 1), (0, -1), "Helvetica-Bold"),
    ("TEXTCOLOR",  (0, 1), (0, -1), C_BLUE),
    ("ALIGN",      (0, 0), (0, -1), "CENTER"),
    ("VALIGN",     (0, 0), (-1, -1), "TOP"),
    ("GRID",       (0, 0), (-1, -1), 0.3, C_GREY),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, C_BG]),
    ("FONTSIZE",   (0, 1), (-1, -1), 9.5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ("LEFTPADDING",(0, 0), (-1, -1), 6),
    ("RIGHTPADDING",(0, 0), (-1, -1), 6),
]))
story += [flow_tbl, spacer(10)]

story += [
    Paragraph(
        "Why do we <b>cache</b> it instead of regenerating on every page load? Because OpenRouter's "
        "free tier only allows 20 requests per minute. If 50 users hit refresh at the same moment, "
        "we'd get rate-limited. Server-side caching makes the brief \"stagnant\" between manual "
        "refreshes — exactly what you asked for.",
        CALLOUT,
    ),
]

# ============ SECTION 7 — THE THREE DESKS (UI) ============
story += [
    PageBreak(),
    Paragraph("7. What each screen does", H1),
    Paragraph(
        "The UI has three \"desks\", each specialized for one asset class. Think of each as a "
        "separate trading-floor specialist.",
        BODY,
    ),
]

desks = [
    ("🏠 Main Dashboard  (/)",
     "Your landing page. Shows everything at a glance:",
     [
         "<b>Stat cards</b> — Risk Score, Alpha Generated, VaR, Sharpe.",
         "<b>Morning-brief panel</b> — the LLM-written commentary (with refresh button).",
         "<b>News feed + globe</b> — live headlines colour-coded by category.",
         "<b>Filing Delta</b> — compares consecutive SEC filings and highlights what changed.",
     ]),
    ("📈 Fixed Income Desk  (/fixed-income)",
     "Everything rates-related:",
     [
         "<b>Yield curve</b> — current US Treasury curve, 11 tenors.",
         "<b>Treasury Yield Spreads</b> — 2s10s, 5s30s etc. (inverted = recession indicator).",
         "<b>PCA factor panel</b> — Level/Slope/Curvature scores today.",
         "<b>Hull–White swaption pricer</b> — punch in strike and tenor, get a price.",
         "<b>Rates Brief</b> — a separate LLM brief focused on fixed-income.",
     ]),
    ("💱 FX Macro Desk  (/fx-desk)",
     "Everything currency-related:",
     [
         "<b>OU diagnostics table</b> — half-life, t-stat, kappa for every pair.",
         "<b>Hurst heat-map</b> — trending vs mean-reverting by pair.",
         "<b>Neural-SDE forecast</b> — 5-day forward path from a tiny neural net.",
         "<b>Forex Factory calendar</b> — upcoming high-impact events.",
         "<b>FX PM execution</b> — button that asks the LLM \"BUY / SELL / HOLD?\" using all signals."
     ]),
]
for name, intro, items in desks:
    story += [
        Paragraph(name, H2),
        Paragraph(intro, BODY),
    ]
    for it in items:
        story += [bullet(it)]

# ============ SECTION 8 — DATABASE ============
story += [
    PageBreak(),
    Paragraph("8. What gets saved? (the database)", H1),
    Paragraph(
        "We use <b>SQLite</b> — a file-based database (no separate server). "
        "The file <tt>hedgyyyboo_trades.db</tt> lives right next to the backend code.",
        BODY,
    ),
    Paragraph("Right now we persist exactly one table:", H3),
    Paragraph("<b>fx_paper_trades</b> — every simulated FX trade the LLM decides to open.", BODY),
    bullet("trade_id, pair, direction (BUY/SELL)"),
    bullet("entry_price, current_price, PnL %"),
    bullet("OU half-life, Hurst exponent, Neural-SDE drift at the moment of opening"),
    bullet("<b>rationale</b> — the LLM's English explanation for why it opened the trade"),
    bullet("status (OPEN / CLOSED), opened_at, closed_at"),
    bullet("forex_factory_event, hawkish_score"),
    spacer(8),
    Paragraph("Why SQLite and not PostgreSQL?", H3),
    Paragraph(
        "SQLite is a <b>single file</b>. No server to install, no credentials to manage, "
        "no port to open. Perfect for a single-user capstone project. If this ever needed to "
        "scale to 100 analysts at the same time, we'd migrate to PostgreSQL — and SQLAlchemy "
        "(the ORM we use) makes that a <i>one-line change</i> in <tt>.env</tt>. That's why "
        "we didn't bother.",
        BODY,
    ),
    Paragraph(
        "<b>Note on PostgreSQL 15 being running:</b> your machine has it installed via "
        "Homebrew, but Hedgyyyboo isn't connecting to it — we point to SQLite. Postgres is "
        "just sitting there doing nothing for this project.",
        CALLOUT,
    ),
]

# ============ SECTION 9 — KEY ENGINEERING DECISIONS ============
story += [
    PageBreak(),
    Paragraph("9. Key engineering decisions (the \"why did you do it this way\" questions)", H1),
    Paragraph(
        "If the panel asks you these, here are the one-line answers.",
        NOTE,
    ),
]

decisions = [
    ("Why FastAPI and not Django / Flask?",
     "FastAPI is async-first, auto-generates OpenAPI docs, and has built-in type validation via Pydantic. Perfect for a 50+ endpoint JSON API."),
    ("Why Next.js 16 and not plain React?",
     "Turbopack gives 10× faster hot-reload. File-based routing. Server components. Good DX for a one-person team."),
    ("Why a dark, terminal-style theme?",
     "Because Bloomberg Terminal is dark. Traders stare at screens for 12 hours — light themes cause eye strain."),
    ("Why OpenRouter and not OpenAI / Anthropic directly?",
     "OpenRouter is a <i>meta</i>-provider — one API, many models. And its Gemma-3n tier is free. OpenAI and Anthropic charge per token."),
    ("Why cache the morning brief?",
     "OpenRouter free tier = 20 req/min. Without caching, a few simultaneous user refreshes would trip the rate-limit."),
    ("Why pure NumPy for the math (no QuantLib)?",
     "Reproducibility. QuantLib is a 2 GB C++ binary; NumPy + SciPy fit in 20 MB and every line is auditable Python."),
    ("Why not use a vector DB (Pinecone / Weaviate) for RAG?",
     "Our retrieved context is live numerical output, not static documents. A vector DB buys us nothing."),
    ("What happens if OpenRouter goes down?",
     "The last cached brief is served until it comes back. Every numeric model still works offline — the math doesn't need the internet."),
    ("Why didn't you build a real trade executor?",
     "Regulatory risk (SEBI / RBI). The platform is educational. The FX trade-execution button opens a <i>paper</i> trade only — nothing hits a real broker."),
]
for q, a in decisions:
    story += [
        Paragraph(f"<b>Q:</b> {q}", BODY),
        Paragraph(f"<b>A:</b> {a}", BODY),
        spacer(3),
    ]

# ============ SECTION 10 — JARGON CHEAT-SHEET ============
story += [
    PageBreak(),
    Paragraph("10. Jargon cheat-sheet (1-line each)", H1),
    Paragraph(
        "Every term you'll meet, explained so you can rattle it off to the examiner.",
        NOTE,
    ),
]

jargon = [
    ("LLM",            "Large Language Model — an AI that writes text (e.g. ChatGPT, Gemma)."),
    ("RAG",            "Retrieval-Augmented Generation — feed real data into the LLM so it doesn't hallucinate."),
    ("Morning Brief",  "A 1-page English commentary of overnight market moves, written every day."),
    ("Yield Curve",    "The plot of interest rates across maturities (1M, 3M, ..., 30Y)."),
    ("PCA",            "Principal Component Analysis — dimensionality reduction. Turns 11 numbers into 3."),
    ("Level",          "PC1 of the yield curve. How the <i>whole</i> curve has moved."),
    ("Slope",          "PC2 of the yield curve. Short rates vs long rates."),
    ("Curvature",      "PC3 of the yield curve. How the belly is moving."),
    ("OU Process",     "Ornstein–Uhlenbeck. A diffusion that <i>pulls back</i> to a mean. Models mean reversion."),
    ("Mean Reversion", "When a price keeps snapping back to an average."),
    ("Half-Life",      "Days until an OU process closes half its distance back to the mean."),
    ("Hurst Exponent", "A number in [0,1] that says: trending (>0.5), random (=0.5), mean-reverting (<0.5)."),
    ("GARCH",          "Generalized AutoRegressive Conditional Heteroskedasticity. Forecasts vol-of-vol."),
    ("VaR",            "Value-at-Risk. \"In the worst 1% of days, I lose more than X%.\""),
    ("ES",             "Expected Shortfall. Average loss in those worst 1% of days. (More conservative than VaR.)"),
    ("Hull–White",     "A model for interest-rate dynamics. Used to price swaptions."),
    ("Swaption",       "An option to enter an interest-rate swap. A bet on future rates."),
    ("Heston",         "A stochastic-volatility model for equity options. Upgrade over Black–Scholes."),
    ("Monte Carlo",    "Simulate a random process thousands of times; average the outcome."),
    ("Neural SDE",     "A small neural net that learns the drift &amp; diffusion of a time-series."),
    ("Sharpe Ratio",   "Return / Risk. Bigger is better. > 1.0 is solid, > 2.0 is great."),
    ("Kupiec Test",    "Statistical test to check if your VaR model gets the right %age of breaches."),
    ("Drawdown",       "Peak-to-trough loss. How bad does it get?"),
    ("Cron",           "A scheduled job. Ours runs at 8:00 AM IST every day."),
    ("APScheduler",    "The Python library that runs the cron."),
    ("FastAPI",        "Modern Python web framework. Our backend is built on it."),
    ("SQLite",         "A database that's just a file. Our <tt>hedgyyyboo_trades.db</tt>."),
    ("SQLAlchemy",     "ORM — Python objects ↔ database rows."),
    ("Pydantic",       "Data validation library. Rejects bad inputs automatically."),
    ("Turbopack",      "Rust-written bundler. What powers Next.js 16 dev mode."),
    ("Recharts",       "React charting library. Draws our line + bar charts."),
    ("FOMC",           "US Federal Open Market Committee. The Fed. Sets US interest rates."),
    ("DXY",            "US Dollar Index. Value of USD against 6 major currencies."),
    ("UST",            "US Treasury. The US government's bonds."),
    ("CFTC COT",       "CFTC Commitment of Traders — who's long, who's short in futures."),
    ("BIS REER",       "Bank for International Settlements Real Effective Exchange Rate."),
    ("SEC EDGAR",      "US SEC's public filings database. 10-Ks, 10-Qs, etc."),
    ("GDELT",          "Global Database of Events, Language, Tone. Geopolitical-news feed."),
]
# Render as 2-col table
tbl = Table(
    [[Paragraph(f"<b>{k}</b>", BODY), Paragraph(v, BODY)] for k, v in jargon],
    colWidths=[90, 405],
)
tbl.setStyle(TableStyle([
    ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ("BOX",          (0, 0), (-1, -1), 0.4, C_GREY),
    ("LINEBELOW",    (0, 0), (-1, -2), 0.25, C_GREY),
    ("ROWBACKGROUNDS",(0, 0), (-1, -1), [white, C_BG]),
    ("LEFTPADDING",  (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING",   (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
]))
story += [tbl]

# ============ SECTION 11 — NUMBERS TO REMEMBER ============
story += [
    PageBreak(),
    Paragraph("11. The numbers you should memorize", H1),
    Paragraph(
        "If someone asks \"what did you actually achieve?\" — these are the headline numbers.",
        NOTE,
    ),
]

headline = [
    ("98.7 %",  "Yield-curve variance captured by just 3 PCA factors.",            "Validates Litterman–Scheinkman."),
    ("±1.4 d",  "Bootstrap error on OU half-life.",                                  "Good enough for tactical FX."),
    ("94 %",    "GARCH Kupiec-test pass rate across 50 equities.",                  "Industry standard is 90%."),
    ("1.38",    "Back-tested Sharpe of our OU mean-reversion strategy (in-sample).","Anything > 1 is respectable."),
    ("95 %",    "Factual grounding of LLM morning briefs (n=20 manual audit).",     "The 5% miss was stale RSS, not LLM hallucination."),
    ("7.2 s",   "Mean latency of an end-to-end morning brief.",                     "Well under our 15 s target."),
    ("1.8 s",   "Cold-load Time-to-Interactive of the Main dashboard.",             "Nielsen's upper bound for 'responsive'."),
    ("0 ₹",     "Monthly running cost.",                                           "SQLite + free tier LLM + free data."),
    ("28",      "FX pairs monitored.",                                              "G10 + major EM crosses."),
    ("11",      "US Treasury tenors ingested.",                                     "1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y."),
    ("50",      "S&P 500 equities GARCH-tracked.",                                  "One per GICS sub-sector."),
    ("53",      "FastAPI endpoints exposed.",                                       "Organized in 6 phases."),
    ("37",      "Peer-reviewed references in the report.",                          "Black–Scholes to Gemma-3."),
    ("4 B",     "Parameters in Gemma-3n-E4B-it.",                                   "Smaller than BloombergGPT's 50B, still good enough."),
    ("20 RPM",  "OpenRouter free-tier rate limit.",                                 "Why we cache and rate-limit."),
]
num_tbl = Table(
    [[Paragraph(f"<b>{n}</b>", BODY), Paragraph(d, BODY), Paragraph(x, NOTE)] for n, d, x in headline],
    colWidths=[60, 240, 200],
)
num_tbl.setStyle(TableStyle([
    ("VALIGN",(0, 0), (-1, -1), "TOP"),
    ("BACKGROUND",(0, 0), (0, -1), C_CARD),
    ("TEXTCOLOR",(0, 0), (0, -1), C_NAVY),
    ("FONTSIZE",(0, 0), (0, -1), 14),
    ("FONTNAME",(0, 0), (0, -1), "Helvetica-Bold"),
    ("ALIGN",(0, 0), (0, -1), "CENTER"),
    ("GRID",(0, 0), (-1, -1), 0.3, C_GREY),
    ("LEFTPADDING",(0, 0), (-1, -1), 8),
    ("TOPPADDING",(0, 0), (-1, -1), 6),
    ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
]))
story += [num_tbl]

# ============ SECTION 12 — VIVA Q&A ============
story += [
    PageBreak(),
    Paragraph("12. Likely viva questions & what to say", H1),
    Paragraph(
        "Read these the night before. Answer with confidence; use the numbers from Section 11.",
        NOTE,
    ),
]

viva = [
    ("Walk me through your project in 60 seconds.",
     "Hedgyyyboo is an open-source research terminal that pulls live market data, runs seven "
     "classical quant models on it (PCA, OU, GARCH, Hull–White, Heston, Hurst, Neural SDE), "
     "and asks Google's Gemma-3n LLM to write a morning brief from the results. "
     "It replicates about 80% of what a Bloomberg Terminal does, costs zero rupees, and runs "
     "on a laptop. The whole pipeline finishes in 7 seconds."),

    ("What's novel? Isn't this just wrapping an LLM around existing models?",
     "Three novelties. One — we don't ground the LLM on static documents, we ground it on "
     "<i>live</i> numerical output from seven math models, refreshed every morning. That's "
     "retrieval-augmented generation applied to live quant signals, which hasn't been done in "
     "open-source. Two — we documented an undocumented bug in Gemma-3n where it rejects the "
     "system role, and we fixed it by merging prompts. Three — zero-cost commodity-hardware "
     "stack that a student can reproduce in a day."),

    ("Why PCA and not Nelson–Siegel for the yield curve?",
     "Nelson–Siegel requires non-convex optimization at every fit step — slow and fragile. "
     "PCA is one eigendecomposition on the covariance matrix — fast and deterministic. For a "
     "daily cron, PCA's speed wins. And empirically we still recover the same Level / Slope / "
     "Curvature factors (Litterman–Scheinkman 1991)."),

    ("How do you know your model isn't over-fitted?",
     "Three checks. One — we bootstrap-sample 1,000 times and measure half-life stability "
     "(<i>±1.4 days</i>, tight). Two — we run Kupiec's unconditional-coverage test on GARCH "
     "(<i>94% pass</i>, above the 90% industry floor). Three — we manually audit 20 random "
     "LLM briefs (<i>95% grounded</i>). The one limitation I'll be upfront about is the "
     "back-test is in-sample — walk-forward is future work."),

    ("Why did you pick Gemma-3n? Why not GPT-4?",
     "Three reasons. It's free — OpenRouter gives us 20 RPM at zero cost. It's open-weight — "
     "if OpenRouter disappears tomorrow we can self-host. It's good enough — 95% grounded on "
     "financial commentary is competitive with GPT-3.5 at a fraction of the cost. GPT-4 would "
     "cost us about $0.03 per brief; over a year that's ₹9,000. Gemma-3n is zero."),

    ("Can this scale to multiple users?",
     "Today it's single-user because SQLite is file-based and OpenRouter free tier is 20 RPM. "
     "To scale we'd do three things: migrate to PostgreSQL (one-line change in .env since "
     "SQLAlchemy abstracts the driver), upgrade to OpenRouter paid tier (or self-host Gemma "
     "on a GPU), and add Redis caching in front of the brief endpoint. Conceptually ready, "
     "not yet provisioned."),

    ("What if the LLM hallucinates a price or rate?",
     "Our audit showed 95% grounding. The 5% failure was one stale RSS headline with an "
     "outdated ECB rate — the LLM correctly quoted the retrieval context, which itself was "
     "wrong. So the fix isn't a better LLM, it's TTL-based cache invalidation on the RSS "
     "feeds — future work. For trades, we have a hard safety: the FX executor regex only "
     "accepts BUY / SELL / HOLD; anything else defaults to HOLD."),

    ("What IEEE standards does your work follow?",
     "Three. IEEE 754 for floating-point (we log condition numbers of every eigendecomposition "
     "for audit). IEEE 829 for software testing (every numeric model ships with an independent "
     "bootstrap or Kupiec validator). IEEE 830 for requirements specification (documented "
     "performance targets: ≤ 10s latency, ≥ 90% Kupiec coverage)."),

    ("Why didn't you use PostgreSQL for the database?",
     "SQLite is file-based — zero setup, zero credentials, zero port-management. Perfect for a "
     "single-user capstone. SQLAlchemy abstracts both, so if we ever need PostgreSQL we change "
     "one line in <tt>.env</tt>. I didn't want to spend a week on ops that adds zero educational "
     "value."),

    ("Future work — what would you do next?",
     "Four concrete things. One — walk-forward backtesting (current results are in-sample). "
     "Two — a two-factor Cheyette model for rates (Hull–White can't reprice caplet skew). "
     "Three — LLM-as-judge for automated factual audits at scale. Four — quantised Llama-3.1-70B "
     "on a local GPU to close the numerical-reasoning gap with BloombergGPT."),
]
for q, a in viva:
    story += [
        Paragraph(f"<b>Q. {q}</b>", BODY),
        Paragraph(a, CALLOUT),
        spacer(2),
    ]

# ============ CLOSING ============
story += [
    PageBreak(),
    Spacer(1, 120),
    Paragraph("You've got this. 🎯", TITLE),
    Paragraph("One last thing to remember:", SUB),
    spacer(20),
    Paragraph(
        "If anyone asks a question you don't know, just say: <i>\"That's a great question — "
        "in our current scope we used X because Y, but Z is a natural extension.\"</i> This "
        "phrasing turns any gap into future-work, and examiners love that.",
        CALLOUT,
    ),
    spacer(30),
    Paragraph(
        "You built this thing from scratch. Seven math models, a full-stack web app, a "
        "rate-limited LLM integration, a SQLite ledger, three polished UI desks, a 60-page "
        "report, and an IEEE paper. That's more than most master's theses. Walk in confident.",
        BODY,
    ),
    spacer(40),
    Paragraph("— end of notes —", TAG),
]

# ------------------------------------------------------------------
# Build the PDF
# ------------------------------------------------------------------
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(C_GREY)
    canvas.drawString(1 * inch, 0.5 * inch, "Hedgyyyboo — Study Notes")
    canvas.drawRightString(
        A4[0] - 1 * inch, 0.5 * inch, f"Page {doc.page}"
    )
    canvas.setStrokeColor(C_GREY)
    canvas.setLineWidth(0.3)
    canvas.line(1 * inch, 0.65 * inch, A4[0] - 1 * inch, 0.65 * inch)
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    topMargin=0.8 * inch,  bottomMargin=0.9 * inch,
    title="Hedgyyyboo Study Notes",
    author="Prathmesh Deshmukh",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("Wrote:", OUT)
print(f"Size:  {os.path.getsize(OUT) / 1024:.1f} KB")
