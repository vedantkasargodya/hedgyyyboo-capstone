/**
 * Hedgyyyboo Capstone Report — v3 build (with figures + tables).
 *
 * Replicates the reference PDF format exactly: body text interleaved with
 * centered figures captioned "Fig. N. <description>" and tables captioned
 * "Table [N]: <title>".  Includes 9 figures and 3 tables.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, TabStopType, PageNumber, NumberFormat, SectionType,
} = require("docx");

const { ABSTRACT_TEXT, CH1, CH2 } = require("./report_content_v3");
const { CH3, CH4, CH5, CH6, REFERENCES } = require("./report_content_v3_pt2");

const HERE = __dirname;
const FONT = "Times New Roman";
const SHORT_NAME = "Hedgyyyboo Analytics Platform";
const YEAR = "2025-2026";
const BODY = 22;
const LINE = 360;

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

// Figure embed: matches reference PDF style exactly — centered image,
// then "Fig. N. <description>" caption in bold + roman.
const figure = (file, n, desc, w = 470, h = 260) => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(path.join(HERE, file)),
      transformation: { width: w, height: h },
      altText: { title: desc, description: desc, name: file },
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 240 },
    children: [
      r(`Fig. ${n}. `, { size: 22, bold: true }),
      r(desc, { size: 22, italics: true }),
    ],
  }),
];

// Plain data table with a caption line above (mirrors "Table [N]: ..." style).
const tableCaption = (text) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 240, after: 80 },
  children: [r(text, { size: 22, bold: true })],
});

const dtable = (headers, rows, widths) => {
  const totalW = widths.reduce((a, b) => a + b, 0);
  const mkCell = (text, isH, w, rightAlign) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [new Paragraph({
      alignment: rightAlign ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { line: 260 },
      children: [r(text, { bold: isH })],
    })],
  });
  const out = [new TableRow({
    children: headers.map((h, j) => mkCell(h, true, widths[j], false)),
  })];
  rows.forEach((row) => out.push(new TableRow({
    children: row.map((c, j) => mkCell(c, false, widths[j],
      /^[0-9$+\-]/.test(String(c)) && j > 0)),  // right-align numeric cols
  })));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    alignment: AlignmentType.CENTER,
    rows: out,
  });
};

// ---------- Figure placement map ----------
// Maps (chapter_num, section_num) → array of figures / tables to insert
// after that section's body text.  Placement mirrors the reference PDF's
// insertion style: diagram in the architecture section, metrics bar in
// the results opener, etc.
const PLACEMENTS = {
  "3.1": [
    { type: "figure", file: "figA_arch.png", n: 1,
      desc: "Hedgyyyboo three-tier system architecture." },
  ],
  "3.4": [
    { type: "figure", file: "fig9_garch.png", n: 2,
      desc: "GARCH(1,1) conditional-volatility forecast on an S&P 500 proxy." },
  ],
  "3.5": [
    { type: "figure", file: "figH_ml_features.png", n: 3,
      desc: "XGBoost screener — top 10 features by importance." },
  ],
  "3.7": [
    { type: "figure", file: "figG_ais.png", n: 4,
      desc: "AIS live chokepoint ship counts (measured at 60 s runtime)." },
  ],
  "4.1": [
    { type: "figure", file: "fig3_scree.png", n: 5,
      desc: "PCA scree plot — three factors capture 98.7% of UST yield-change variance." },
    { type: "figure", file: "fig4_loadings.png", n: 6,
      desc: "PC1–PC3 eigenvector loadings vs tenor: Level, Slope, Curvature." },
  ],
  "4.3": [
    { type: "figure", file: "figJ_equity_dd.png", n: 7,
      desc: "Auto-PM realised equity curve and drawdown over 100 trading days." },
  ],
  "4.5": [
    { type: "figure", file: "figB_metrics.png", n: 8,
      desc: "Quantitative performance metrics comparison against target thresholds." },
    { type: "table", caption: "Table [1]: System Performance Metrics Summary",
      headers: ["Metric", "Value", "Target Threshold"],
      rows: [
        ["PCA 3-factor variance share", "98.7%", ">90%"],
        ["OU half-life bootstrap error", "±1.4 d", "<2 d"],
        ["GARCH Kupiec coverage (1% VaR)", "94.0%", ">90%"],
        ["Backtest Sharpe ratio",           "1.38",  ">1.00"],
        ["LLM grounding accuracy (n=20)",   "95.0%", ">90%"],
        ["End-to-end morning brief latency","7.2 s", "<15 s"],
        ["UI Time-to-Interactive",          "1.8 s", "<3 s"],
        ["FX desk load (post-GDELT fix)",   "4.8 s", "<10 s"],
        ["AIS ships cached (60 s runtime)", "15 k+", ">1 k"],
        ["ML screener validation AUC",      "0.58",  ">0.55"],
      ],
      widths: [4000, 2100, 2000],
    },
    { type: "figure", file: "figI_llm_usage.png", n: 9,
      desc: "LLM usage analytics: auto-PM decision tally and per-endpoint mean latency." },
  ],
  "5.1": [
    { type: "figure", file: "figC_efficiency.png", n: 10,
      desc: "Workflow efficiency: Traditional workflow vs Hedgyyyboo platform on log-scale axis (morning-brief time, FX decision latency, tools consulted per day, narrative output accuracy)." },
  ],
  "6.1": [
    { type: "figure", file: "figF_radar.png", n: 11,
      desc: "Hedgyyyboo qualitative internal-audit assessment across Grounding, Latency, Coverage, Breadth, Zero-Cost and Reproducibility (scale 1-5)." },
  ],
};

function buildChapter(ch) {
  const out = [];
  out.push(...chapterTitle(ch.number, ch.title));
  out.push(...paras(ch.intro));
  for (const s of ch.sections) {
    const dots = (s.num.match(/\./g) || []).length;
    if (dots <= 1) out.push(sectionHead(s.num, s.title));
    else out.push(subHead(s.num, s.title));
    out.push(...paras(s.body));
    // Insert any placement figures/tables belonging to this section.
    for (const item of PLACEMENTS[s.num] || []) {
      if (item.type === "figure") {
        out.push(...figure(item.file, item.n, item.desc));
      } else if (item.type === "table") {
        out.push(tableCaption(item.caption));
        out.push(dtable(item.headers, item.rows, item.widths));
        out.push(new Paragraph({ spacing: { after: 200 }, children: [r("")] }));
      }
    }
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

// ---------- Title / Certificate / Ack / Abstract / TOC ----------
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
  center("Project Report submitted in the partial fulfilment", { run: { size: 24, bold: true }, after: 120 }),
  center("of",                                                  { run: { size: 24 }, after: 120 }),
  center("Bachelor of Technology in",                           { run: { size: 26, bold: true, color: "2E75B6" }, after: 40 }),
  center("Computer Engineering",                                { run: { size: 26, bold: true, color: "2E75B6" }, after: 180 }),
  center("by",                                                  { run: { size: 24 }, after: 80 }),
  center("Prathmesh Deshmukh (Roll No.: XXXXXXXX)",             { run: { size: 24, bold: true }, after: 120 }),
  center("Under the supervision of",                            { run: { size: 22 }, after: 80 }),
  center("Prof. [Name of Faculty Mentor]",                      { run: { size: 24, bold: true, underline: {} }, after: 80 }),
  center("(Designation, Department of Computer Engineering, MPSTME)",
         { run: { size: 22, italics: true }, after: 240 }),
  center("SVKM's NMIMS University",                             { run: { size: 28, bold: true }, after: 80 }),
  center("(Deemed-to-be University)",                           { run: { size: 22, italics: true }, after: 240 }),
  center("MUKESH PATEL SCHOOL OF TECHNOLOGY MANAGEMENT &",      { run: { size: 24, bold: true }, after: 40 }),
  center("ENGINEERING (MPSTME)",                                { run: { size: 24, bold: true }, after: 80 }),
  center("Vile Parle (W), Mumbai-56",                           { run: { size: 24, bold: true }, after: 240 }),
  center(YEAR,                                                  { run: { size: 24, bold: true }, after: 0 }),
];

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

const acknowledgementPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 400, line: LINE },
    children: [r("ACKNOWLEDGEMENT", { size: 34, bold: true, underline: {} })] }),
  p("I would like to express my heartfelt gratitude to my mentor, Prof. [Name of Faculty Mentor], for her constant guidance, valuable insights, and unwavering support throughout the development of this project.", { firstLine: false }),
  p("I am also deeply thankful to the Head of Department and the internal review panel for providing constructive feedback at each capstone review. My sincere thanks go to the Mukesh Patel School of Technology, Management and Engineering (MPSTME), NMIMS, for offering a platform that fosters learning, research, and experimentation.", { firstLine: false }),
  p("I gratefully acknowledge the open-source community — the developers of FastAPI, Next.js, NumPy, SciPy, scikit-learn, XGBoost, arch, Recharts and react-simple-maps — without whose freely-available, permissively-licensed software this project would have been economically infeasible. I thank OpenRouter for providing free-tier inference access to Google's Gemma-3n-E4B-it model, and AISStream for the global AIS data feed. I thank Google DeepMind for releasing the Gemma family under an open licence.", { firstLine: false }),
  p("Finally, I extend my appreciation to all the faculty members and peers who provided feedback, encouragement, and inspiration during every phase of this journey.", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 480 },
    children: [r("Prathmesh Deshmukh", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT,
    children: [r("Roll No.: XXXXXXXX · SAP ID: XXXXXXXXXX", { italics: true })] }),
];

const abstractPage = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 480 },
    children: [r("ABSTRACT", { size: 40, bold: true })] }),
  ...paras(ABSTRACT_TEXT, { run: { italics: true }, firstLine: false }),
];

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
  tocLine("Chapter 2: Literature Review", "7", true),
  tocLine("2.1 Evolution of Quantitative Analytics", "7"),
  tocLine("2.2 Stochastic Calculus Pricing Models", "9"),
  tocLine("2.3 Factor Models and Yield-Curve Analysis", "10"),
  tocLine("2.4 Volatility and Tail-Risk Modelling", "11"),
  tocLine("2.5 LLMs and Retrieval-Augmented Generation", "12"),
  tocLine("2.6 Alternative Data and Marine-AIS Analytics", "13"),
  tocLine("2.7 Machine Learning for Trade Selection", "14"),
  tocLine("Chapter 3: Methodology and Implementation", "16", true),
  tocLine("3.1 System Architecture and Block Diagram", "16"),
  tocLine("3.2 Hardware Components and Specifications", "19"),
  tocLine("3.3 The Seven Numerical Engines", "20"),
  tocLine("3.4 Autonomous Trade Engine", "23"),
  tocLine("3.5 ML Screener and Historical Backfill", "26"),
  tocLine("3.6 LLM Integration and Persistent Call Log", "28"),
  tocLine("3.7 AISStream Marine Consumer", "30"),
  tocLine("3.8 Presentation Layer — Five Desks", "31"),
  tocLine("Chapter 4: Results and Analysis", "34", true),
  tocLine("4.1 PCA Yield-Curve Decomposition", "34"),
  tocLine("4.2 OU Mean-Reversion Diagnostics", "35"),
  tocLine("4.3 Backtest of OU Mean-Reversion Strategy", "36"),
  tocLine("4.4 GARCH Tail-Risk Calibration", "37"),
  tocLine("4.5 LLM Latency, Grounding and Decision Quality", "38"),
  tocLine("4.6 ML Screener Training Metrics", "39"),
  tocLine("4.7 AIS Throughput and Chokepoint Coverage", "40"),
  tocLine("4.8 Cross-Desk End-to-End Latency", "41"),
  tocLine("Chapter 5: Advantages, Limitations and Applications", "42", true),
  tocLine("5.1 Key Advantages of the System", "42"),
  tocLine("5.2 Current Limitations", "44"),
  tocLine("5.3 Practical Applications", "45"),
  tocLine("5.4 Future Development Directions", "46"),
  tocLine("Chapter 6: Conclusion", "48", true),
  tocLine("6.1 Summary of Key Findings", "48"),
  tocLine("6.2 Contributions to the Field", "49"),
  tocLine("6.3 Addressing the Research Problem", "50"),
  tocLine("6.4 Practical Impact and Real-World Value", "50"),
  tocLine("6.5 Limitations and Future Directions", "51"),
  tocLine("6.6 Broader Implications", "51"),
  tocLine("6.7 Final Thoughts", "52"),
  tocLine("REFERENCES", "54", true),
  tocLine("APPENDICES", "55", true),
  tocLine("Appendix A: Source Code and Flowcharts", "55"),
  tocLine("Appendix B: Dataset Information", "56"),
  tocLine("Appendix C: List of Components", "57"),
  tocLine("Appendix D: List of Papers Presented and Published", "58"),
  new Paragraph({ spacing: { before: 240, after: 60 },
    children: [r("List of Figures", { bold: true })] }),
  ...[
    ["Fig. 1",  "Hedgyyyboo three-tier system architecture", "16"],
    ["Fig. 2",  "GARCH(1,1) conditional-volatility forecast",  "24"],
    ["Fig. 3",  "XGBoost screener — top 10 feature importances", "27"],
    ["Fig. 4",  "AIS live chokepoint ship counts",              "30"],
    ["Fig. 5",  "PCA scree plot",                                "34"],
    ["Fig. 6",  "PC1–PC3 eigenvector loadings vs tenor",          "34"],
    ["Fig. 7",  "Auto-PM realised equity curve and drawdown",     "36"],
    ["Fig. 8",  "Quantitative performance metrics comparison",   "38"],
    ["Fig. 9",  "LLM usage analytics (decisions + latency)",      "39"],
    ["Fig. 10", "Workflow efficiency — Traditional vs Hedgyyyboo","42"],
    ["Fig. 11", "Qualitative internal-audit radar (1-5)",         "48"],
  ].map(([a, b, c]) => new Paragraph({
    spacing: { after: 60, line: 260 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
    children: [r(`${a}  ${b}`, { size: 21 }), r(`\t${c}`, { size: 21 })],
  })),
  new Paragraph({ spacing: { before: 200, after: 60 },
    children: [r("List of Tables", { bold: true })] }),
  new Paragraph({
    spacing: { after: 60, line: 260 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
    children: [r("Table [1]  System Performance Metrics Summary", { size: 21 }),
               r("\t38", { size: 21 })],
  }),
  new Paragraph({
    spacing: { after: 60, line: 260 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
    children: [r("Table [2]  Dataset Overview (Appendix B)", { size: 21 }),
               r("\t56", { size: 21 })],
  }),
  new Paragraph({
    spacing: { after: 60, line: 260 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
    children: [r("Table [3]  Hardware & Software Components (Appendix C)", { size: 21 }),
               r("\t57", { size: 21 })],
  }),
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
    children: [r("https://github.com/vedantkasargodya/hedgyyyboo-capstone",
                 { size: 22, italics: true, color: "2E75B6" })] }),
  ...figure("fig7_dataflow.png", "A.1",
    "Data-flow across ingestion, numeric core, LLM core, and UI layers.", 470, 270),
  ...figure("fig8_usecase.png", "A.2",
    "Use-case diagram: Portfolio Manager interacts with five primary use cases.", 430, 290),
  p("Key backend modules and their responsibilities are listed below. Every module is purely synchronous Python apart from the AIS WebSocket consumer and the async HTTP client used for OpenRouter.", { firstLine: false }),
  p("• app/main.py — FastAPI application, 53+ REST endpoints, startup lifespan that boots every subsystem.", { firstLine: false }),
  p("• app/signal_packet.py — OU MLE, Hurst R/S, GARCH(1,1), price summary builders.", { firstLine: false }),
  p("• app/trade_engine.py — auto-PM cycle, mark-and-manage, close rules, trailing stop, fresh-price fetcher.", { firstLine: false }),
  p("• app/paper_trades_model.py — unified multi-desk trade ledger + PnL helpers (RATES sign inversion).", { firstLine: false }),
  p("• app/market_hours.py — FX/EQUITY/RATES open-hours gating.", { firstLine: false }),
  p("• app/ml_model.py — XGBoost classifier, feature extraction, training, inference, persistence.", { firstLine: false }),
  p("• app/historical_backfill.py — walk-forward synthetic-trade generator with OHLC stops, tx-cost haircut, duration-weighted rates.", { firstLine: false }),
  p("• app/rag_brain.py — context builder, route classifier, LLM call wrapper.", { firstLine: false }),
  p("• app/llm_stats.py — process-local counter + SQLite LLMCallLog persistence.", { firstLine: false }),
  p("• app/ais_stream.py — AISStream WebSocket consumer, chokepoint aggregation.", { firstLine: false }),
  p("• app/gdelt_geo.py — GDELT geopolitical-stress index with pre-warm and single-flight lock.", { firstLine: false }),
  p("• app/scheduler.py — APScheduler cron setup (morning note, MTM, auto-PM, ML retrain).", { firstLine: false }),
];

const appendixB = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix B", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("Dataset Information", { size: 24, bold: true })] }),
  tableCaption("Table [2]: Dataset Overview"),
  dtable(
    ["Field", "Description"],
    [
      ["Source",         "Seven live public data sources; no synthetic data on any live code path"],
      ["Primary feeds",  "Yahoo Finance, US Treasury, Google News RSS, SEC EDGAR, AISStream, CFTC COT, OpenRouter"],
      ["Persistence",    "SQLite (backend/hedgyyyboo_trades.db) — migratable to PostgreSQL via DATABASE_URL"],
      ["Tables",         "fx_paper_trades, paper_trades (unified), historical_samples, llm_call_log"],
      ["AIS throughput", "≈3-4 messages/sec; 15,000+ unique MMSI cached within 60s of startup"],
      ["Historical samples", "~5,200 synthetic closed trades across 13 watchlist symbols over 2 years"],
      ["LLM log retention","Last 500 calls rehydrated into memory on every restart"],
    ],
    [2200, 6800],
  ),
  new Paragraph({ spacing: { before: 200 }, children: [r("")] }),
  p("The seven primary datasets are: (1) Yahoo Finance for FX spot, equity closes, UST yields; (2) the U.S. Treasury Daily Yield Curve for the 11 benchmark tenors used by PCA; (3) Google News RSS across 10 categories used by the Ask-PM context block and morning brief; (4) SEC EDGAR full-text search for the Filing Delta Engine; (5) AISStream's global WebSocket stream for live ship positions; (6) CFTC Commitments of Traders for FX positioning signals; (7) the OpenRouter Chat Completions API hosting Gemma-3n-E4B-it at the free tier's 20 requests/minute throughput cap.", { firstLine: false }),
  p("The synthetic data generator present on disk (app/data_generator.py) is retained for reference and for offline demonstrations but is disabled on every live code path. Any response derived from it is explicitly tagged source: 'synthetic_fallback' so both the UI and the examiner can distinguish it from live market data.", { firstLine: false }),
];

const appendixC = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix C", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("List of Components", { size: 24, bold: true })] }),
  tableCaption("Table [3]: Hardware Components"),
  dtable(
    ["Component", "Specification / Description"],
    [
      ["Laptop / Workstation", "Apple MacBook Pro M-series (2023), 16 GB unified memory, 1 TB SSD — or equivalent x86-64 laptop"],
      ["Processor",            "Apple Silicon / Intel i5 / AMD Ryzen 5 or above (min. 3.0 GHz)"],
      ["RAM",                  "Minimum 16 GB DDR4/LPDDR5"],
      ["Storage",              "SSD with ≥ 20 GB free (platform data + venv + node_modules)"],
      ["Display",              "1920×1080 or higher recommended; 1366×768 laptop screens also supported"],
      ["Network",              "Broadband ≥ 25 Mbps for AIS streaming + API calls"],
      ["GPU",                  "Not required — LLM inference is remote via OpenRouter"],
    ],
    [2600, 6400],
  ),
  new Paragraph({ spacing: { before: 200 }, children: [r("")] }),
  tableCaption("Software Components"),
  dtable(
    ["Software", "Version / Functionality"],
    [
      ["Python",             "3.11+ — primary backend language"],
      ["FastAPI / Uvicorn",  "0.128 / 0.39 — ASGI REST framework and server"],
      ["SQLAlchemy / SQLite","2.0 / 3 — trade ledger + LLM log persistence"],
      ["NumPy / SciPy",      "2.0 / 1.14 — vectorised math"],
      ["scikit-learn",       "1.6 — PCA eigendecomposition"],
      ["xgboost",            "3.2 — ML trade screener"],
      ["arch",               "GARCH(1,1) fitting (disabled in backfill due to segfault risk)"],
      ["yfinance",           "Yahoo Finance client"],
      ["httpx / websockets", "Async HTTP + WebSocket clients"],
      ["APScheduler",        "3.10 — cron scheduling"],
      ["Node.js",            "20+ — frontend runtime"],
      ["Next.js / React",    "16 / 19 — SSR + routing"],
      ["TypeScript",         "5 — type-safe JS"],
      ["Tailwind CSS",       "4 — utility-first styling"],
      ["Recharts",           "3 — data-visualisation"],
      ["react-simple-maps",  "3 — global marine-traffic map"],
      ["OpenRouter API",     "Free tier · Gemma-3n-E4B-it · 20 RPM"],
      ["AISStream API",      "Free global WebSocket AIS stream"],
    ],
    [2600, 6400],
  ),
];

const appendixD = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240, line: LINE },
    children: [r("Appendix D", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320, line: LINE },
    children: [r("List of Papers Presented and Published", { size: 24, bold: true })] }),
  dtable(
    ["Field", "Description"],
    [
      ["Title",     "Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus and Principal Component Factor Models for Real-Time Multi-Asset Portfolio Decision Support"],
      ["Author",    "Prathmesh Deshmukh"],
      ["Institution","SVKM's NMIMS University, MPSTME, Mumbai, India"],
      ["Status",    "IEEE-format manuscript prepared for conference submission"],
      ["Repository","https://github.com/vedantkasargodya/hedgyyyboo-capstone"],
    ],
    [2200, 6800],
  ),
  new Paragraph({ spacing: { before: 240 }, children: [r("")] }),
  p("The repository contains the complete backend source, frontend source, capstone report DOCX (this document), IEEE paper DOCX, and study-notes PDF. Every figure embedded in this report is regenerable from the Python scripts in paper/generate_*.py and paper/gen_v3_charts.py.", { firstLine: false }),
  new Paragraph({ spacing: { before: 200 }, children: [r("")] }),
  tableCaption("Figure list"),
  dtable(
    ["Figure No", "Description", "Page"],
    [
      ["Fig. 1",  "Hedgyyyboo three-tier system architecture",           "16"],
      ["Fig. 2",  "GARCH(1,1) conditional-volatility forecast",          "24"],
      ["Fig. 3",  "XGBoost screener — top 10 feature importances",       "27"],
      ["Fig. 4",  "AIS live chokepoint ship counts",                      "30"],
      ["Fig. 5",  "PCA scree plot (98.7% cumulative variance)",            "34"],
      ["Fig. 6",  "PC1-PC3 loadings vs tenor",                             "34"],
      ["Fig. 7",  "Auto-PM realised equity curve and drawdown",            "36"],
      ["Fig. 8",  "Quantitative performance metrics vs targets",           "38"],
      ["Fig. 9",  "LLM usage analytics (decisions + latency)",             "39"],
      ["Fig. 10", "Workflow efficiency — Traditional vs Hedgyyyboo",       "42"],
      ["Fig. 11", "Qualitative internal-audit radar",                      "48"],
      ["Fig. A.1","Data-flow architecture (Appendix A)",                    "55"],
      ["Fig. A.2","Use-case diagram (Appendix A)",                          "55"],
    ],
    [1200, 5800, 1200],
  ),
];

// ---------- Assemble ----------
const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo Capstone Report (v3 with figures)",
  description: "NMIMS MPSTME Capstone report — full platform with figures + tables matching reference PDF",
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
