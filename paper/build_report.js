/**
 * Hedgyyyboo — NMIMS Capstone Project Black Book Report
 * ------------------------------------------------------
 * Spec compliance (A.8 of Guidelines, pp. 22-23):
 *   Font            Times New Roman
 *   Line spacing    1.5
 *   Left margin     1.5"
 *   Other margins   1"
 *   Header L        Project title
 *   Header R        Academic year
 *   Footer R        Page number
 *   Chapter title   18pt bold
 *   Section title   14pt bold
 *   Subsection      12pt bold
 *   Body            12pt
 *   Fig caption     10pt below figure
 *   Table caption   10pt above table
 *   TOC / List-of pages in Roman numerals
 *   Chapter pages in decimal
 *   Every chapter has intro + summary
 *   One conclusion only (at end)
 *   Hard Bound Black Book
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageOrientation, SectionType, LevelFormat, PageNumber, PageNumberFormat,
  Header, Footer, PageBreak, TabStopType, TabStopPosition, NumberFormat,
} = require("docx");

const { ABSTRACT_TEXT, CH1, CH2 } = require("./report_content");
const {
  CH3, CH4, CH5, CH6, REFERENCES,
  APPENDIX_A_CODE, APPENDIX_B_API, APPENDIX_C_COMPONENTS,
} = require("./report_content_2");

const HERE = __dirname;
const FONT = "Times New Roman";
const PROJECT_TITLE = "HEDGYYYBOO — MULTI-ASSET QUANTITATIVE ANALYTICS PLATFORM";
const ACADEMIC_YEAR = "Academic Year 2025-26";

// 12pt = 24 half-points. Line spacing 1.5 = 360 twips.
const BODY_SIZE = 24;
const BODY_LINE = 360;

// ---------- helpers ----------
const tr = (text, opts = {}) => new TextRun({
  text, font: FONT, size: opts.size || BODY_SIZE,
  bold: opts.bold, italics: opts.italics, underline: opts.underline,
});

const body = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { before: 0, after: 120, line: BODY_LINE },
  indent: opts.firstLine === false ? undefined : { firstLine: 360 },
  children: [tr(text, { size: BODY_SIZE, ...opts.run })],
});

const bodyParas = (bigText, opts = {}) =>
  bigText.split(/\n\n+/).map((p) => body(p.trim(), opts));

// Chapter title: 18pt bold, centered, new page before
const chapterTitle = (num, title) => [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 240 },
    children: [tr(`Chapter ${num}`, { size: 36, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 480, line: BODY_LINE },
    children: [tr(title, { size: 36, bold: true })],
  }),
];

// Section title: 14pt bold, left
const sectionTitle = (num, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 300, after: 160, line: BODY_LINE },
  children: [tr(`${num}  ${title}`, { size: 28, bold: true })],
});

// Subsection title: 12pt bold, left
const subsectionTitle = (num, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 240, after: 120, line: BODY_LINE },
  children: [tr(`${num}  ${title}`, { size: 24, bold: true })],
});

// Figure embed with 10pt caption BELOW
const figureEmbed = (file, caption, width = 440, height = 260) => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(path.join(HERE, file)),
      transformation: { width, height },
      altText: { title: caption, description: caption, name: file },
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240, line: BODY_LINE },
    children: [tr(caption, { size: 20, italics: true })],
  }),
];

// Table caption (10pt) ABOVE
const tableCaption = (text) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 60 },
  children: [tr(text, { size: 20, italics: true })],
});

// Data table
const dataTable = (headers, rows, widths) => {
  const totalW = widths.reduce((a, b) => a + b, 0);
  const mkCell = (text, isHeader, widthDxa) => new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: isHeader ? { fill: "E6E6E6", type: ShadingType.CLEAR } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 },
      children: [tr(text, { size: 22, bold: isHeader })],
    })],
  });

  const rowsOut = [];
  rowsOut.push(new TableRow({
    children: headers.map((h, j) => mkCell(h, true, widths[j])),
  }));
  rows.forEach((r) => rowsOut.push(new TableRow({
    children: r.map((c, j) => mkCell(c, false, widths[j])),
  })));

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    alignment: AlignmentType.CENTER,
    rows: rowsOut,
  });
};

// Build a full chapter (with intro + sections + summary)
function buildChapter(ch) {
  const out = [];
  out.push(...chapterTitle(ch.number, ch.title));
  // Intro
  out.push(...bodyParas(ch.intro));
  // Sections
  for (const s of ch.sections) {
    // Decide section or subsection style based on dot count
    const dots = (s.num.match(/\./g) || []).length;
    if (dots <= 1) {
      out.push(sectionTitle(s.num, s.title));
    } else {
      out.push(subsectionTitle(s.num, s.title));
    }
    out.push(...bodyParas(s.body));
    if (s.fig) out.push(...figureEmbed(s.fig.file, s.fig.caption));
    if (s.figs) s.figs.forEach((f) => out.push(...figureEmbed(f.file, f.caption)));
    if (s.table) {
      out.push(tableCaption(s.table.caption));
      const widths = s.table.headers.map(() => Math.floor(8640 / s.table.headers.length));
      out.push(dataTable(s.table.headers, s.table.rows, widths));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [tr("")] }));
    }
  }
  // Summary
  out.push(sectionTitle(`${ch.number}.${ch.sections.length + 1}`, "Summary"));
  out.push(...bodyParas(ch.summary));
  return out;
}

// ====================================================================
// FRONT MATTER (Roman numeral pagination)
// ====================================================================

// ---- Title page ----
const titlePage = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("HEDGYYYBOO", { size: 56, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [tr("Multi-Asset Quantitative Analytics Platform with", { size: 32, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [tr("Retrieval-Augmented LLM Narrative Layer", { size: 32, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 160 },
    children: [tr("Project Report submitted in the partial fulfilment", { size: 24, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [tr("of", { size: 24 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [tr("Bachelor of Technology", { size: 24, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [tr("in", { size: 24 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 560 },
    children: [tr("Computer Science & Engineering", { size: 24, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [tr("by", { size: 24, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [tr("Prathmesh Deshmukh (Roll No.: XXXXXXXX)", { size: 24, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 560 },
    children: [tr("SAP ID: XXXXXXXXXX", { size: 24 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [tr("Under the supervision of", { size: 24, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [tr("Prof. [Name of Faculty Mentor]", { size: 24, bold: true, underline: {} })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [tr("(Designation, Department of Computer Engineering, MPSTME)", { size: 22, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [tr("SVKM's NMIMS University", { size: 30, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [tr("(Deemed-to-be University)", { size: 22, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [tr("Mukesh Patel School of Technology Management & Engineering (MPSTME)", { size: 24, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [tr("Vile Parle (W), Mumbai-56", { size: 24 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [tr(ACADEMIC_YEAR, { size: 24, bold: true })],
  }),
];

// ---- Certificate page ----
const certificatePage = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 320 },
    children: [tr("CERTIFICATE", { size: 40, bold: true, underline: {} })],
  }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 360, after: 240, line: BODY_LINE },
    indent: { firstLine: 360 },
    children: [
      tr("This is to certify that the project entitled "),
      tr("\"Hedgyyyboo: Multi-Asset Quantitative Analytics Platform with Retrieval-Augmented LLM Narrative Layer\"", { bold: true }),
      tr(" has been done by "),
      tr("Mr. Prathmesh Deshmukh", { bold: true }),
      tr(" under my guidance and supervision and has been submitted in partial fulfilment of the degree of "),
      tr("Bachelor of Technology", { bold: true }),
      tr(" in "),
      tr("Computer Science & Engineering", { bold: true }),
      tr(" of MPSTME, SVKM's NMIMS (Deemed-to-be University), Mumbai, India during the academic year 2025-26."),
    ],
  }),
  new Paragraph({ spacing: { before: 600 }, children: [tr("")] }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    spacing: { before: 360, after: 360 },
    children: [
      tr("________________________"),
      tr("\t________________________"),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    spacing: { after: 120 },
    children: [
      tr("Project Mentor (Name & Signature)", { bold: true }),
      tr("\tExaminer (Name & Signature)", { bold: true }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 80 },
    children: [tr("(Internal Guide)", { italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    children: [tr("Date: ____________")],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 600 },
    children: [tr("Place: Mumbai")],
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 120 },
    children: [tr("________________________")],
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 80 },
    children: [tr("(HoD)  (Name & Signature)", { bold: true })],
  }),
];

// ---- Acknowledgement ----
const acknowledgementPage = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("ACKNOWLEDGEMENT", { size: 40, bold: true, underline: {} })],
  }),
  body("I take this opportunity to express my deepest gratitude to all those who have directly or indirectly contributed to the successful completion of this capstone project. First and foremost, I am profoundly thankful to my project mentor Prof. [Name of Faculty Mentor], whose unwavering guidance, critical feedback, and technical insights shaped every chapter of this report and every commit in the accompanying code-base. His patience during the early, exploratory phase of the project and his rigour during the evaluation phase were equally invaluable."),
  body("I gratefully acknowledge the Department of Computer Engineering at the Mukesh Patel School of Technology Management & Engineering (MPSTME), and specifically Dr. Koteswararao Anne, Dean of MPSTME, whose stewardship of the capstone programme has created an environment that rewards intellectual curiosity and production-grade engineering alike."),
  body("I extend my thanks to the internal and external panel members who reviewed this project at each of the three formal reviews; their probing questions materially improved the rigour of the experimental evaluation reported in Chapter 4."),
  body("I am indebted to the open-source community — the developers of FastAPI, Next.js, NumPy, SciPy, scikit-learn, Recharts, and the many libraries listed in Appendix C — without whose freely-available, permissively-licensed software this project would have been economically infeasible. I thank OpenRouter for providing free-tier access to the Gemma-3n-E4B-it model, and I thank Google DeepMind for releasing the Gemma model family under an open licence."),
  body("Finally, I thank my family for their unflagging moral and material support throughout the seventeen weeks of this project."),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 480 }, children: [tr("Prathmesh Deshmukh", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr("Roll No.: XXXXXXXX", { italics: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr("SAP ID: XXXXXXXXXX", { italics: true })] }),

  // Student table
  new Paragraph({ spacing: { before: 400, after: 120 }, children: [tr("Student details:", { bold: true })] }),
  dataTable(
    ["Name", "Roll No.", "SAP ID"],
    [["Prathmesh Deshmukh", "XXXXXXXX", "XXXXXXXXXX"]],
    [3200, 2500, 2940],
  ),
];

// ---- Abstract ----
const abstractPage = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 480 },
    children: [tr("ABSTRACT", { size: 40, bold: true })],
  }),
  ...bodyParas(ABSTRACT_TEXT),
];

// ---- Table of Contents ----
const tocHeading = (t) => new Paragraph({
  spacing: { before: 120, after: 60 },
  tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
  children: [tr(t, { bold: true }), tr("\tPage No.", { bold: true })],
});

const tocLine = (text, pgNum, indent = 0, bold = false) => new Paragraph({
  spacing: { after: 60, line: 280 },
  indent: { left: indent },
  tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
  children: [tr(text, { bold }), tr(`\t${pgNum}`, { bold })],
});

const tocPage = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("Table of Contents", { size: 32, bold: true })],
  }),
  tocHeading("Topic"),
  tocLine("Certificate",          "ii"),
  tocLine("Acknowledgement",      "iii"),
  tocLine("Abstract",             "iv"),
  tocLine("Table of Contents",    "v"),
  tocLine("List of Figures",      "ix"),
  tocLine("List of Tables",       "x"),
  tocLine("Abbreviations",        "xi"),
  tocLine("Chapter 1 — Introduction", "1", 0, true),
  tocLine("1.1  Background of the Project Topic",       "1", 360),
  tocLine("1.2  Motivation and Scope of the Report",    "2", 360),
  tocLine("1.3  Problem Statement",                      "3", 360),
  tocLine("1.4  Salient Contribution",                   "4", 360),
  tocLine("1.5  Organisation of the Report",             "5", 360),
  tocLine("1.6  Summary",                                "6", 360),
  tocLine("Chapter 2 — Literature Survey", "7", 0, true),
  tocLine("2.1  Introduction to the Overall Topic",               "7", 360),
  tocLine("2.2  Stochastic Calculus Pricing Models",              "9", 360),
  tocLine("2.3  Factor Models and Yield-Curve Dimensionality Reduction", "11", 360),
  tocLine("2.4  Volatility and Tail-Risk Models",                "12", 360),
  tocLine("2.5  Neural Stochastic Differential Equations",       "14", 360),
  tocLine("2.6  LLMs in Finance and RAG",                        "15", 360),
  tocLine("2.7  Research Gap and Problem Formulation",           "17", 360),
  tocLine("2.8  Summary",                                        "18", 360),
  tocLine("Chapter 3 — Methodology and Implementation", "19", 0, true),
  tocLine("3.1  Block Diagram of the System",           "19", 360),
  tocLine("3.2  Hardware and Software Description",     "20", 360),
  tocLine("3.3  Software Description, Flowchart and Algorithms", "22", 360),
  tocLine("3.3.1  Ornstein–Uhlenbeck MLE",              "23", 720),
  tocLine("3.3.2  Hurst Exponent",                       "24", 720),
  tocLine("3.3.3  GARCH(1,1)",                           "24", 720),
  tocLine("3.3.4  PCA of the Yield Curve",               "25", 720),
  tocLine("3.3.5  Hull–White Swaption",                  "26", 720),
  tocLine("3.3.6  Heston Monte-Carlo",                   "27", 720),
  tocLine("3.3.7  Neural SDE",                           "27", 720),
  tocLine("3.3.8  LLM Integration Layer",                "28", 720),
  tocLine("3.4  Use-Case Diagram",                       "29", 360),
  tocLine("3.5  Development Timeline",                   "30", 360),
  tocLine("3.6  Summary",                                "31", 360),
  tocLine("Chapter 4 — Results and Analysis", "32", 0, true),
  tocLine("4.1  PCA Yield-Curve Decomposition",         "32", 360),
  tocLine("4.2  OU Mean-Reversion Diagnostics",         "34", 360),
  tocLine("4.3  Back-Test",                              "35", 360),
  tocLine("4.4  GARCH Kupiec Coverage",                 "36", 360),
  tocLine("4.5  LLM Latency and Hallucination Audit",    "37", 360),
  tocLine("4.6  UI Performance",                         "38", 360),
  tocLine("4.7  IEEE Standards Compliance",              "39", 360),
  tocLine("4.8  Summary",                                "40", 360),
  tocLine("Chapter 5 — Advantages, Limitations and Applications", "41", 0, true),
  tocLine("5.1  Advantages",                             "41", 360),
  tocLine("5.2  Limitations",                            "42", 360),
  tocLine("5.3  Applications",                           "44", 360),
  tocLine("5.4  Summary",                                "46", 360),
  tocLine("Chapter 6 — Conclusion and Future Scope", "47", 0, true),
  tocLine("6.1  Summary of Work Carried Out",           "47", 360),
  tocLine("6.2  Conclusions",                            "48", 360),
  tocLine("6.3  Future Scope",                           "49", 360),
  tocLine("6.4  Summary",                                "50", 360),
  tocLine("References",         "51", 0, true),
  tocLine("Appendix A — Source Code", "54", 0, true),
  tocLine("Appendix B — Sample API Payloads", "56", 0, true),
  tocLine("Appendix C — Component List", "57", 0, true),
  tocLine("Appendix D — List of Papers Presented and Published", "59", 0, true),
];

// ---- List of Figures ----
const listOfFigures = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("List of Figures", { size: 32, bold: true })],
  }),
  dataTable(
    ["Fig. No.", "Name of the Figure", "Page No."],
    [
      ["3.1",  "Hedgyyyboo three-tier block diagram", "19"],
      ["3.2",  "Data-flow architecture", "22"],
      ["3.3",  "GARCH(1,1) conditional volatility forecast", "24"],
      ["3.4",  "Use-case diagram", "29"],
      ["3.5",  "Gantt chart — project development timeline", "30"],
      ["4.1",  "PCA scree plot of U.S. Treasury yield changes", "32"],
      ["4.2",  "PC1–PC3 eigenvector loadings vs tenor", "33"],
      ["4.3",  "OU strategy cumulative return vs carry benchmark", "35"],
      ["4.4",  "End-to-end morning-brief LLM latency", "37"],
      ["4.5",  "Main dashboard screenshot", "38"],
    ],
    [1200, 5400, 1200],
  ),
];

// ---- List of Tables ----
const listOfTables = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("List of Tables", { size: 32, bold: true })],
  }),
  dataTable(
    ["Table No.", "Name of the Table", "Page No."],
    [
      ["4.1", "OU MLE parameters on top-5 G10 crosses", "34"],
      ["C.1", "Component and library inventory",       "57"],
    ],
    [1200, 5400, 1200],
  ),
];

// ---- Abbreviations ----
const abbreviations = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("Abbreviations", { size: 32, bold: true })],
  }),
  dataTable(
    ["Sr. No.", "Abbreviation", "Expansion"],
    [
      ["1",  "API",     "Application Programming Interface"],
      ["2",  "AR",      "Autoregressive"],
      ["3",  "BIS",     "Bank for International Settlements"],
      ["4",  "CFTC",    "Commodity Futures Trading Commission"],
      ["5",  "COT",     "Commitments of Traders"],
      ["6",  "EDGAR",   "Electronic Data Gathering, Analysis, and Retrieval"],
      ["7",  "ES",      "Expected Shortfall"],
      ["8",  "FX",      "Foreign Exchange"],
      ["9",  "GARCH",   "Generalised Autoregressive Conditional Heteroskedasticity"],
      ["10", "GDELT",   "Global Database of Events, Language, and Tone"],
      ["11", "HTTP",    "Hypertext Transfer Protocol"],
      ["12", "IEEE",    "Institute of Electrical and Electronics Engineers"],
      ["13", "JSON",    "JavaScript Object Notation"],
      ["14", "LLM",     "Large Language Model"],
      ["15", "MLE",     "Maximum Likelihood Estimation"],
      ["16", "OU",      "Ornstein–Uhlenbeck"],
      ["17", "PCA",     "Principal Component Analysis"],
      ["18", "PDE",     "Partial Differential Equation"],
      ["19", "PM",      "Portfolio Manager"],
      ["20", "RAG",     "Retrieval-Augmented Generation"],
      ["21", "REER",    "Real Effective Exchange Rate"],
      ["22", "REST",    "Representational State Transfer"],
      ["23", "RPM",     "Requests per Minute"],
      ["24", "RSI",     "Relative Strength Index"],
      ["25", "RSS",     "Really Simple Syndication"],
      ["26", "SDE",     "Stochastic Differential Equation"],
      ["27", "SEC",     "Securities and Exchange Commission"],
      ["28", "SQL",     "Structured Query Language"],
      ["29", "UST",     "United States Treasury"],
      ["30", "VaR",     "Value-at-Risk"],
    ],
    [1000, 2200, 5400],
  ),
];


// ====================================================================
// Main chapters (decimal pagination from Chapter 1 onwards)
// ====================================================================
const ch1 = buildChapter(CH1);
const ch2 = buildChapter(CH2);
const ch3 = buildChapter(CH3);
const ch4 = buildChapter(CH4);
const ch5 = buildChapter(CH5);
const ch6 = buildChapter(CH6);

// References
const refsPage = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 1000, after: 360 },
    children: [tr("REFERENCES", { size: 36, bold: true })],
  }),
  ...REFERENCES.map((r, i) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 300 },
    indent: { left: 540, hanging: 540 },
    children: [tr(`[${i + 1}]  ${r}`, { size: 24 })],
  })),
];

// Appendix A — Source Code
const appendixA = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 480, after: 360 },
    children: [tr("Appendix A : Source Code and Flowcharts", { size: 32, bold: true })],
  }),
  body("Appendix A presents representative source-code excerpts and algorithmic flowcharts of the Hedgyyyboo numerical engine. The full source tree is available in the accompanying ZIP archive."),
  new Paragraph({ spacing: { before: 120, after: 80 }, children: [tr("A.1 Ornstein–Uhlenbeck MLE estimator (Python)", { size: 24, bold: true })] }),
  new Paragraph({
    spacing: { before: 80, after: 240, line: 280 },
    shading: { fill: "F3F3F3", type: ShadingType.CLEAR },
    children: [new TextRun({ text: APPENDIX_A_CODE, font: "Courier New", size: 20 })],
  }),
];

// Appendix B — Sample API Payload
const appendixB = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 480, after: 360 },
    children: [tr("Appendix B : Sample API Payloads", { size: 32, bold: true })],
  }),
  body("Appendix B presents a representative request / response payload of the primary Hedgyyyboo REST endpoint."),
  new Paragraph({
    spacing: { before: 80, after: 240, line: 280 },
    shading: { fill: "F3F3F3", type: ShadingType.CLEAR },
    children: [new TextRun({ text: APPENDIX_B_API, font: "Courier New", size: 20 })],
  }),
];

// Appendix C — Component list
const appendixC = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 480, after: 360 },
    children: [tr("Appendix C : List of Components", { size: 32, bold: true })],
  }),
  body("Appendix C enumerates every hardware / software component and external data source used in the Hedgyyyboo platform."),
  tableCaption("Table C.1. Component and library inventory."),
  dataTable(
    ["Sr. No.", "Component / Library", "Role in Hedgyyyboo"],
    APPENDIX_C_COMPONENTS.map((pair, i) => [String(i + 1), pair[0], pair[1]]),
    [1000, 3400, 4200],
  ),
];

// Appendix D — Papers
const appendixD = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 480, after: 360 },
    children: [tr("Appendix D : List of Papers Presented and Published", { size: 32, bold: true })],
  }),
  body("Appendix D lists papers and technical documents produced in the course of this capstone project."),
  new Paragraph({
    spacing: { after: 120, line: 300 },
    indent: { left: 540, hanging: 540 },
    children: [tr("[P1]  P. Deshmukh, \"Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus and Principal Component Factor Models for Real-Time Multi-Asset Portfolio Decision Support,\" manuscript prepared for an IEEE conference submission, April 2026.", { size: 24 })],
  }),
  new Paragraph({
    spacing: { after: 120, line: 300 },
    indent: { left: 540, hanging: 540 },
    children: [tr("[P2]  P. Deshmukh, Hedgyyyboo Technical Report (this document), MPSTME, SVKM's NMIMS University, April 2026.", { size: 24 })],
  }),
];


// ====================================================================
// Page setup helpers
// ====================================================================

// 1.5" = 2160 twips; 1" = 1440 twips
const NMIMS_MARGIN = { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 720, footer: 720 };

const PAGE = {
  size: { width: 12240, height: 15840 },     // US Letter
  margin: NMIMS_MARGIN,
};

// Header (left = project title, right = academic year)
const makeHeader = () => new Header({
  children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    spacing: { after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 2 } },
    children: [
      tr(PROJECT_TITLE, { size: 18 }),
      tr(`\t${ACADEMIC_YEAR}`, { size: 18 }),
    ],
  })],
});

// Footer (right = page number)
const makeFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60 },
    children: [
      tr("Page ", { size: 18 }),
      new TextRun({ font: FONT, size: 18, children: [PageNumber.CURRENT] }),
    ],
  })],
});

// ====================================================================
// Compose document with two sections: Roman front, Arabic body
// ====================================================================
const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo Capstone Report",
  description: "NMIMS MPSTME Capstone black book report",
  styles: {
    default: { document: { run: { font: FONT, size: BODY_SIZE } } },
  },
  sections: [
    // Section 1: Title page (no header/footer, no page number)
    {
      properties: {
        page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      children: titlePage,
    },
    // Section 2: Front matter (Roman numerals ii…)
    {
      properties: {
        page: { ...PAGE, pageNumbers: { start: 2, formatType: NumberFormat.LOWER_ROMAN } },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: [
        ...certificatePage,
        ...acknowledgementPage,
        ...abstractPage,
        ...tocPage,
        ...listOfFigures,
        ...listOfTables,
        ...abbreviations,
      ],
    },
    // Section 3: Main body (Arabic numerals, restart at 1)
    {
      properties: {
        page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: [
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
  const out = path.join(HERE, "Hedgyyyboo_Capstone_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, `(${(buf.length / 1024).toFixed(1)} KB)`);
});
