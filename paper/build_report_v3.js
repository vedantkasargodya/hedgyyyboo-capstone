/**
 * Hedgyyyboo Capstone Report — v3 build script.
 * Uses v3 content (all features including /analytics, /ai-models,
 * /research AIS page, ML screener, historical backfill, persistent
 * LLM log, trailing stop, market-hours gating).
 *
 * Format follows the reference "Gamified Computer Vision" PDF:
 *   TNR 11pt body, 1.5 spacing, justified
 *   Chapter title "Chapter N : Title" — 18pt bold centered
 *   Section: 14pt bold left "N.M Title"
 *   Subsection: 12pt bold left "N.M.K Title"
 *   Header L: short project name  |  Header R: "2025-2026"
 *   Footer: plain right-aligned page number
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, TabStopType, PageNumber, NumberFormat, SectionType, TabStopPosition,
} = require("docx");

const { ABSTRACT_TEXT, CH1, CH2 } = require("./report_content_v3");
const { CH3, CH4, CH5, CH6, REFERENCES } = require("./report_content_v3_pt2");

const HERE = __dirname;
const FONT = "Times New Roman";
const SHORT_NAME = "Hedgyyyboo Analytics Platform";
const YEAR = "2025-2026";
const BODY = 22;          // 11pt
const LINE = 360;         // 1.5 line spacing

// ---------- helpers ----------
const r = (t, o = {}) => new TextRun({
  text: t, font: FONT, size: o.size || BODY,
  bold: o.bold, italics: o.italics, underline: o.underline, color: o.color,
});

const p = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: o.line || LINE },
  indent: o.firstLine === false ? undefined : { firstLine: 360 },
  children: [r(text, o.run || {})],
});

const paras = (big, o) => big.trim().split(/\n\n+/).map((t) => p(t.trim(), o));

const center = (text, o = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: o.before || 0, after: o.after || 120, line: LINE },
  children: [r(text, o.run || {})],
});

const chapterTitle = (num, title) => [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r(`Chapter ${num} : ${title}`, { size: 36, bold: true })],
  }),
];

const sectionHead = (num, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 320, after: 160, line: LINE },
  children: [r(`${num} ${title}`, { size: 28, bold: true })],
});

const subHead = (num, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 220, after: 120, line: LINE },
  children: [r(`${num} ${title}`, { size: 24, bold: true })],
});

function buildChapter(ch) {
  const out = [];
  out.push(...chapterTitle(ch.number, ch.title));
  out.push(...paras(ch.intro));
  for (const s of ch.sections) {
    const dots = (s.num.match(/\./g) || []).length;
    if (dots <= 1) out.push(sectionHead(s.num, s.title));
    else out.push(subHead(s.num, s.title));
    out.push(...paras(s.body));
  }
  out.push(sectionHead(`${ch.number}.${ch.sections.length + 1}`, "Summary"));
  out.push(...paras(ch.summary));
  return out;
}

// ---------- Page setup ----------
const PAGE = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
};

const hdr = () => new Header({ children: [new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
  spacing: { after: 0 },
  children: [ r(SHORT_NAME, { size: 20 }), r(`\t${YEAR}`, { size: 20 }) ],
})] });

const ftr = () => new Footer({ children: [new Paragraph({
  alignment: AlignmentType.RIGHT,
  children: [ new TextRun({ font: FONT, size: 20, children: [PageNumber.CURRENT] }) ],
})] });


// ---------- Title page ----------
const titlePage = [
  new Paragraph({ spacing: { before: 1200, after: 240 }, children: [r("")] }),
  new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { after: 120, line: LINE },
    children: [r("Hedgyyyboo: A Multi-Asset Quantitative Analytics", { size: 44, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { after: 320, line: LINE },
    children: [r("Platform with Autonomous Trade Engine, ML Screener and Live Marine-AIS Research", { size: 44, bold: true })],
  }),
  center("Project Report submitted in the partial fulfilment",   { run: { size: 24, bold: true }, after: 120 }),
  center("of",                                                    { run: { size: 24 }, after: 120 }),
  center("Bachelor of Technology in",                             { run: { size: 26, bold: true, color: "2E75B6" }, after: 40 }),
  center("Computer Engineering",                                  { run: { size: 26, bold: true, color: "2E75B6" }, after: 180 }),
  center("by",                                                    { run: { size: 24 }, after: 80 }),
  center("Prathmesh Deshmukh (Roll No.: XXXXXXXX)",               { run: { size: 24, bold: true }, after: 120 }),
  center("Under the supervision of",                              { run: { size: 22 }, after: 80 }),
  center("Prof. [Name of Faculty Mentor]",                         { run: { size: 24, bold: true, underline: {} }, after: 80 }),
  center("(Designation, Department of Computer Engineering, MPSTME)",
         { run: { size: 22, italics: true }, after: 240 }),
  center("SVKM's NMIMS University",                               { run: { size: 28, bold: true }, after: 80 }),
  center("(Deemed-to-be University)",                             { run: { size: 22, italics: true }, after: 240 }),
  center("MUKESH PATEL SCHOOL OF TECHNOLOGY MANAGEMENT &",        { run: { size: 24, bold: true }, after: 40 }),
  center("ENGINEERING (MPSTME)",                                  { run: { size: 24, bold: true }, after: 80 }),
  center("Vile Parle (W), Mumbai-56",                             { run: { size: 24, bold: true }, after: 240 }),
  center(YEAR,                                                    { run: { size: 24, bold: true }, after: 0 }),
];

// ---------- Certificate page ----------
const certificatePage = [
  new Paragraph({ pageBreakBefore: true, spacing: { before: 400, after: 120 }, alignment: AlignmentType.CENTER,
    children: [r(`(${YEAR})`, { size: 24, bold: true })] }),
  center("CERTIFICATE", { run: { size: 34, bold: true, underline: {} }, after: 400 }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 240, after: 200, line: LINE },
    children: [
      r("This is to certify that the project entitled "),
      r("\"Hedgyyyboo: A Multi-Asset Quantitative Analytics Platform with Autonomous Trade Engine, ML Screener and Live Marine-AIS Research\"", { bold: true }),
      r(", has been done by "),
      r("Mr. Prathmesh Deshmukh", { bold: true }),
      r(" under my guidance and supervision & has been submitted in partial fulfilment of the degree of Bachelor of Technology in Computer Engineering of MPSTME, SVKM's NMIMS (Deemed-to-be University), Mumbai, India."),
    ],
  }),
  new Paragraph({ spacing: { before: 480, after: 120 }, children: [r("")] }),
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    spacing: { after: 60 },
    children: [r("___________________"), r("\t___________________")],
  }),
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    spacing: { after: 80 },
    children: [r("Project mentor (Name & Signature)", { bold: true }),
               r("\tExaminer (Name & Signature)", { bold: true })],
  }),
  new Paragraph({ spacing: { after: 60 }, children: [r("(Internal Guide)", { italics: true })] }),
  new Paragraph({ spacing: { after: 120 }, children: [r("Date:", { bold: true })] }),
  new Paragraph({ spacing: { before: 200, after: 80 },
    children: [r("Place: Mumbai", { bold: true, underline: {} })] }),
  new Paragraph({ spacing: { before: 280, after: 60 },
    children: [r("(HoD) (Name & Signature)", { bold: true })] }),
];

// ---------- Acknowledgement ----------
const acknowledgementPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 400, line: LINE },
    children: [r("ACKNOWLEDGEMENT", { size: 34, bold: true, underline: {} })] }),
  p("I would like to express my heartfelt gratitude to my mentor, Prof. [Name of Faculty Mentor], for her constant guidance, valuable insights, and unwavering support throughout the development of this project. Her mentorship has been instrumental in shaping every chapter of this report and every commit in the accompanying code base.", { firstLine: false }),
  p("I am also deeply thankful to the Head of Department and the internal review panel for providing constructive feedback at each capstone review. My sincere thanks go to the Mukesh Patel School of Technology, Management and Engineering (MPSTME), NMIMS, for offering a platform that fosters learning, research, and experimentation.", { firstLine: false }),
  p("I gratefully acknowledge the open-source community — the developers of FastAPI, Next.js, NumPy, SciPy, scikit-learn, XGBoost, arch, Recharts and react-simple-maps — without whose freely-available, permissively-licensed software this project would have been economically infeasible. I thank OpenRouter for providing free-tier inference access to Google's Gemma-3n-E4B-it model, and AISStream for providing free global AIS data streams. I thank Google DeepMind for releasing the Gemma model family under an open licence.", { firstLine: false }),
  p("Finally, I extend my appreciation to all the faculty members and peers who provided feedback, encouragement, and inspiration during every phase of this journey.", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 480 },
    children: [r("Prathmesh Deshmukh", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT,
    children: [r("Roll No.: XXXXXXXX · SAP ID: XXXXXXXXXX", { italics: true })] }),
];

// ---------- Abstract ----------
const abstractPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 480 },
    children: [r("ABSTRACT", { size: 40, bold: true })] }),
  ...paras(ABSTRACT_TEXT, { run: { italics: true }, firstLine: false }),
];

// ---------- TOC ----------
const tocLine = (t, pg, bold) => new Paragraph({
  spacing: { after: 100, line: 280 },
  tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
  children: [r(t, { bold }), r(`\t${pg}`, { bold })],
});

const tocPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("TABLE OF CONTENTS", { size: 34, bold: true })] }),
  tocLine("ABSTRACT", "iv"),
  tocLine("Chapter 1: Introduction", "1", true),
  tocLine("1.1 Background Information", "1"),
  tocLine("1.2 Motivation and Scope of the Report", "2"),
  tocLine("1.3 Problem Statement", "3"),
  tocLine("1.4 Salient Contributions", "4"),
  tocLine("1.5 Organisation of Report", "5"),
  tocLine("1.6 Summary", "6"),
  tocLine("Chapter 2: Literature Review", "7", true),
  tocLine("2.1 Evolution of Quantitative Analytics in Finance", "7"),
  tocLine("2.2 Stochastic Calculus Pricing Models", "9"),
  tocLine("2.3 Factor Models and Yield-Curve Analysis", "10"),
  tocLine("2.4 Volatility and Tail-Risk Modelling", "11"),
  tocLine("2.5 Large Language Models and RAG", "12"),
  tocLine("2.6 Alternative Data and Marine-AIS Analytics", "13"),
  tocLine("2.7 Machine Learning for Trade Selection", "14"),
  tocLine("2.8 Summary", "15"),
  tocLine("Chapter 3: Methodology and Implementation", "16", true),
  tocLine("3.1 System Architecture and Block Diagram", "16"),
  tocLine("3.2 Hardware Components and Specifications", "19"),
  tocLine("3.3 The Seven Numerical Engines", "20"),
  tocLine("3.4 Autonomous Trade Engine", "23"),
  tocLine("3.5 ML Screener and Historical Backfill", "26"),
  tocLine("3.6 LLM Integration and Persistent Call Log", "28"),
  tocLine("3.7 AISStream Marine Consumer", "30"),
  tocLine("3.8 Presentation Layer — Five Desks", "31"),
  tocLine("3.9 Summary", "33"),
  tocLine("Chapter 4: Results and Analysis", "34", true),
  tocLine("4.1 PCA Yield-Curve Decomposition", "34"),
  tocLine("4.2 OU Mean-Reversion Diagnostics", "35"),
  tocLine("4.3 Backtest of OU Mean-Reversion Strategy", "36"),
  tocLine("4.4 GARCH Tail-Risk Calibration", "36"),
  tocLine("4.5 LLM Latency, Grounding and Decision Quality", "37"),
  tocLine("4.6 ML Screener Training Metrics", "38"),
  tocLine("4.7 AIS Throughput and Chokepoint Coverage", "39"),
  tocLine("4.8 Cross-Desk End-to-End Latency", "40"),
  tocLine("4.9 Summary", "41"),
  tocLine("Chapter 5: Advantages, Limitations and Applications", "42", true),
  tocLine("5.1 Key Advantages of the System", "42"),
  tocLine("5.2 Current Limitations", "44"),
  tocLine("5.3 Practical Applications", "45"),
  tocLine("5.4 Future Development Directions", "46"),
  tocLine("5.5 Summary", "47"),
  tocLine("Chapter 6: Conclusion", "48", true),
  tocLine("6.1 Summary of Key Findings", "48"),
  tocLine("6.2 Contributions to the Field", "49"),
  tocLine("6.3 Addressing the Research Problem", "50"),
  tocLine("6.4 Practical Impact and Real-World Value", "50"),
  tocLine("6.5 Limitations and Future Directions", "51"),
  tocLine("6.6 Broader Implications for Quantitative Finance", "51"),
  tocLine("6.7 Final Thoughts", "52"),
  tocLine("6.8 Summary", "53"),
  tocLine("REFERENCES", "54", true),
  tocLine("APPENDICES", "55", true),
  tocLine("Appendix A: Source Code and Flowcharts", "55"),
  tocLine("Appendix B: Dataset Information", "56"),
  tocLine("Appendix C: List of Components", "57"),
  tocLine("Appendix D: List of Papers Presented and Published", "58"),
];

// ---------- Chapters ----------
const ch1 = buildChapter(CH1);
const ch2 = buildChapter(CH2);
const ch3 = buildChapter(CH3);
const ch4 = buildChapter(CH4);
const ch5 = buildChapter(CH5);
const ch6 = buildChapter(CH6);

// ---------- References ----------
const refsPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: LINE },
    children: [r("References", { size: 34, bold: true })] }),
  ...REFERENCES.map((ref, i) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 300 },
    indent: { left: 360, hanging: 360 },
    children: [r(`${i + 1}.  `, { size: 22 }), r(ref, { size: 22 })],
  })),
];

// ---------- Appendices ----------
const appendixA = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix A", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("Source Code and System Flowcharts", { size: 24, bold: true })] }),
  p("The complete Hedgyyyboo source code is published at:", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 },
    children: [r("https://github.com/vedantkasargodya/hedgyyyboo-capstone", { size: 22, italics: true, color: "2E75B6" })] }),

  p("The repository is organised into two top-level trees — `backend/` (Python/FastAPI) and `hedgyyyboo-frontend/` (Next.js/TypeScript). Key backend modules:", { firstLine: false }),
  p("• app/main.py — FastAPI application, 53+ REST endpoints, startup lifespan that boots every subsystem.", { firstLine: false }),
  p("• app/signal_packet.py — OU MLE, Hurst R/S, GARCH(1,1), price summary builders.", { firstLine: false }),
  p("• app/trade_engine.py — auto-PM cycle, mark-and-manage, close rules, trailing stop, fresh-price fetcher.", { firstLine: false }),
  p("• app/paper_trades_model.py — unified multi-desk trade ledger + PnL helpers (including RATES sign inversion).", { firstLine: false }),
  p("• app/market_hours.py — FX/EQUITY/RATES open-hours gating.", { firstLine: false }),
  p("• app/ml_model.py — XGBoost classifier, feature extraction, training, inference, persistence.", { firstLine: false }),
  p("• app/historical_backfill.py — walk-forward synthetic-trade generator with OHLC stops, tx-cost haircut, duration-weighted rates.", { firstLine: false }),
  p("• app/rag_brain.py — context builder, route classifier, LLM call wrapper.", { firstLine: false }),
  p("• app/llm_stats.py — process-local counter + SQLite LLMCallLog persistence.", { firstLine: false }),
  p("• app/ais_stream.py — AISStream WebSocket consumer, chokepoint aggregation.", { firstLine: false }),
  p("• app/gdelt_geo.py — GDELT geopolitical-stress index with pre-warm and single-flight lock.", { firstLine: false }),
  p("• app/scheduler.py — APScheduler cron setup (morning note, MTM, auto-PM, ML retrain).", { firstLine: false }),
  p("Frontend routes are under hedgyyyboo-frontend/src/app: `page.tsx` (Main), `fx-desk`, `fixed-income`, `analytics`, `ai-models`, `research`. Components live under `src/components/` and are individually dynamic-imported on pages that need them.", { firstLine: false }),
];

const appendixB = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix B", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("Dataset Information", { size: 24, bold: true })] }),
  p("The Hedgyyyboo platform consumes seven distinct live data sources. No synthetic data is used in any live-trading code path. The synthetic data generator remains on disk as a last-resort fallback for offline demonstrations but every response produced from it is tagged `source: 'synthetic_fallback'` so the UI and examiner can see it is not live market data.", { firstLine: false }),
  p("Primary datasets:", { firstLine: false }),
  p("1. Yahoo Finance — FX spot, equity closes, UST yield tenors (^TNX, ^FVX, ^TYX, ^IRX). Accessed via the yfinance Python library at ~500 ms per ticker.", { firstLine: false }),
  p("2. U.S. Treasury Daily Yield Curve — 11 benchmark tenors from 1-month bills to 30-year bonds. Used for PCA factor decomposition.", { firstLine: false }),
  p("3. Google News RSS — 10 category feeds (markets, macro, tech, FX, india, geopolitical, commodities, bonds, earnings, monetary). Used for the Ask-PM context block and morning brief.", { firstLine: false }),
  p("4. SEC EDGAR full-text search — for Filing Delta Engine. Returns the text of 10-K and 10-Q filings for vector-diff analysis.", { firstLine: false }),
  p("5. AISStream WebSocket — global real-time AIS position reports (PositionReport and ShipStaticData message types). Requires a free API key from aisstream.io/authenticate.", { firstLine: false }),
  p("6. CFTC Commitments of Traders — weekly futures-positioning data for the FX desk.", { firstLine: false }),
  p("7. OpenRouter Chat Completions API — Gemma-3n-E4B-it free tier at 20 requests/minute throughput cap. Requires a free API key from openrouter.ai/keys.", { firstLine: false }),
  p("All persistent data lives in a single SQLite file, `backend/hedgyyyboo_trades.db`, with four tables: `fx_paper_trades` (legacy), `paper_trades` (unified multi-desk ledger), `historical_samples` (synthetic backfill training data), and `llm_call_log` (every LLM request with prompt, response, tokens, latency, decision). The database is portable — migrating to PostgreSQL requires only a `DATABASE_URL` change in the `.env` file.", { firstLine: false }),
];

const appendixC = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix C", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("List of Components", { size: 24, bold: true })] }),
  p("Hardware components used for platform development and reference deployment:", { firstLine: false }),
  p("• Apple MacBook Pro M-series (2023), 16 GB unified memory, 1 TB SSD. Equivalent x86-64 laptops with 16 GB DDR4 RAM and an SSD suffice.", { firstLine: false }),
  p("• Broadband Internet connection at 25 Mbps or higher for AIS streaming and API calls.", { firstLine: false }),
  p("Backend software components (Python 3.11+):", { firstLine: false }),
  p("• FastAPI 0.128 + Uvicorn 0.39 — REST application framework and ASGI server.", { firstLine: false }),
  p("• SQLAlchemy 2.0 + SQLite 3 — persistence layer for paper_trades, llm_call_log, historical_samples.", { firstLine: false }),
  p("• NumPy 2.0 + SciPy — linear algebra and numerical primitives.", { firstLine: false }),
  p("• scikit-learn 1.6 — PCA eigendecomposition.", { firstLine: false }),
  p("• xgboost 3.2 — gradient-boosted-tree trade screener.", { firstLine: false }),
  p("• arch — GARCH(1,1) fitting.", { firstLine: false }),
  p("• yfinance — Yahoo Finance wrapper.", { firstLine: false }),
  p("• httpx — async HTTP client for OpenRouter.", { firstLine: false }),
  p("• websockets — AISStream WebSocket client.", { firstLine: false }),
  p("• APScheduler 3.10 — cron scheduling (morning brief, MTM, auto-PM, ML retrain).", { firstLine: false }),
  p("• python-dotenv — environment-variable loading.", { firstLine: false }),
  p("Frontend software components (Node.js 20+):", { firstLine: false }),
  p("• Next.js 16 + React 19 — UI framework with SSR and client-side routing.", { firstLine: false }),
  p("• TypeScript 5 — type-safe JavaScript superset.", { firstLine: false }),
  p("• Tailwind CSS 4 — utility-first styling.", { firstLine: false }),
  p("• Recharts 3 — data-visualisation for analytics equity curve.", { firstLine: false }),
  p("• react-simple-maps 3 — Equal-Earth projection for global marine-traffic map.", { firstLine: false }),
  p("• lucide-react — icon library.", { firstLine: false }),
  p("External services:", { firstLine: false }),
  p("• OpenRouter — free Gemma-3n-E4B-it inference at 20 RPM.", { firstLine: false }),
  p("• AISStream.io — free global AIS WebSocket stream.", { firstLine: false }),
];

const appendixD = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix D", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("List of Papers Presented and Published", { size: 24, bold: true })] }),
  p("This capstone project has generated the following technical-research artefacts:", { firstLine: false }),
  p("1. Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus and Principal Component Factor Models for Real-Time Multi-Asset Portfolio Decision Support. IEEE-format conference paper prepared for submission. Documents the architectural approach, empirical validation results, and the Gemma-3n system-prompt merge discovery that allows RAG stacks to operate on the OpenRouter free tier.", { firstLine: false }),
  p("2. Hedgyyyboo Capstone Project Report (this document). 58-page technical report in the NMIMS MPSTME capstone format documenting the full platform including autonomous trade engine, ML screener, historical backfill, persistent LLM call log, live AIS marine-traffic research desk, and five-desk front-end.", { firstLine: false }),
  p("3. Hedgyyyboo Study Notes (PDF). 16-page friendly-language guide covering the 'what' and 'why' of every subsystem, intended as viva preparation material.", { firstLine: false }),
  p("Source-code repository:", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 },
    children: [r("https://github.com/vedantkasargodya/hedgyyyboo-capstone", { size: 22, italics: true, color: "2E75B6" })] }),
  p("The repository contains the complete backend source, frontend source, capstone report DOCX, IEEE paper DOCX, and study-notes PDF. All chart artefacts used in the report are regenerable from the Python scripts in `paper/generate_*.py`.", { firstLine: false }),
];


// ---------- Document assembly ----------
const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo Capstone Report (v3)",
  description: "NMIMS MPSTME Capstone report — full platform including analytics, AIS research, ML screener and LLM observability",
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  sections: [
    {
      properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: titlePage,
    },
    {
      properties: { page: { ...PAGE, pageNumbers: { start: 2, formatType: NumberFormat.DECIMAL } } },
      headers: { default: hdr() },
      footers: { default: ftr() },
      children: [
        ...certificatePage,
        ...acknowledgementPage,
        ...abstractPage,
        ...tocPage,
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...ch5,
        ...ch6,
        ...refsPage,
        ...appendixA,
        ...appendixB,
        ...appendixC,
        ...appendixD,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(HERE, "Hedgyyyboo_Capstone_Report_v3.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, `(${(buf.length / 1024).toFixed(1)} KB)`);
});
