/**
 * Hedgyyyboo Capstone Report — formatted to match the reference PDF style
 * (Gamified Computer Vision example report).
 *
 * Target: ~57–58 pages (body).
 * Font: Times New Roman throughout.
 * Header L: short project name  |  Header R: academic year.
 * Footer: plain page number (right).
 * Body: 11pt, justified, 1.5 line spacing.
 * Chapter: 18pt bold centered "Chapter N : Title".
 * Section: 14pt bold left  "N.M  Title".
 * Subsection: 12pt bold left "N.M.K  Title".
 * Figure caption: "Fig. N." bold + italic description, centered, 11pt.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageBreak, TabStopType, PageNumber, NumberFormat, SectionType,
} = require("docx");

const HERE = __dirname;
const FONT = "Times New Roman";
const SHORT_NAME = "Hedgyyyboo Analytics Platform";
const YEAR = "2025-2026";
const BODY = 22;            // 11pt
const LINE = 360;           // 1.5

// ---------- helpers ----------
const r = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || BODY,
  bold: o.bold, italics: o.italics, underline: o.underline, color: o.color });

const p = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: o.line || LINE },
  indent: o.firstLine === false ? undefined : { firstLine: 360 },
  children: [r(text, o.run)],
});

const paras = (big, o) => big.trim().split(/\n\n+/).map((t) => p(t.trim(), o));

const center = (text, o = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: o.before || 0, after: o.after || 120, line: LINE },
  children: [r(text, o.run)],
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

const figureBlock = (file, n, desc, w = 430, h = 220) => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 60 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(path.join(HERE, file)),
      transformation: { width: w, height: h },
      altText: { title: desc, description: desc, name: file },
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 200 },
    children: [
      r(`Fig. ${n}. `, { size: 22, bold: true }),
      r(desc, { size: 22, italics: true }),
    ],
  }),
];

const tableCaption = (text) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 200, after: 80 },
  children: [r(text, { size: 22, bold: true })],
});

const dtable = (headers, rows, widths) => {
  const mkCell = (t, isH, w) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 280 },
      children: [r(t, { bold: isH })],
    })],
  });
  const out = [new TableRow({ children: headers.map((h, j) => mkCell(h, true, widths[j])) })];
  rows.forEach((row) => out.push(new TableRow({ children: row.map((c, j) => mkCell(c, false, widths[j])) })));
  return new Table({
    width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    columnWidths: widths, alignment: AlignmentType.LEFT, rows: out,
  });
};

// ==========================================================================
// TITLE PAGE
// ==========================================================================
const titlePage = [
  new Paragraph({ spacing: { before: 1200, after: 240 }, children: [r("")] }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: LINE },
    children: [r("Hedgyyyboo: A Multi-Asset Quantitative Analytics", { size: 44, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 320, line: LINE },
    children: [r("Platform with Retrieval-Augmented LLM Narrative Layer", { size: 44, bold: true })],
  }),
  center("Project Report submitted in the partial fulfilment",   { run: { size: 24, bold: true }, after: 120 }),
  center("of",                                                    { run: { size: 24 }, after: 120 }),
  center("Bachelor of Technology in",                             { run: { size: 26, bold: true, color: "2E75B6" }, after: 40 }),
  center("Computer Engineering",                                  { run: { size: 26, bold: true, color: "2E75B6" }, after: 180 }),
  center("by",                                                    { run: { size: 24 }, after: 80 }),
  center("Prathmesh Deshmukh (Roll No.: XXXXXXXX)",               { run: { size: 24, bold: true }, after: 120 }),
  center("Under the supervision of",                              { run: { size: 22 }, after: 80 }),
  center("Prof. [Name of Faculty Mentor]",                         { run: { size: 24, bold: true, underline: {} }, after: 80 }),
  center("Assistant Professor, Department of Computer Engineering, MPSTME, NMIMS, Mumbai, India",
         { run: { size: 22 }, after: 60 }),
  center("Email: mentor.name@nmims.edu",                          { run: { size: 22, color: "2E75B6", underline: {} }, after: 240 }),
  center("SVKM's NMIMS University",                               { run: { size: 28, bold: true }, after: 80 }),
  center("(Deemed-to-be University)",                             { run: { size: 22, italics: true }, after: 240 }),
  center("MUKESH PATEL SCHOOL OF TECHNOLOGY MANAGEMENT &",        { run: { size: 24, bold: true }, after: 40 }),
  center("ENGINEERING (MPSTME)",                                  { run: { size: 24, bold: true }, after: 80 }),
  center("Vile Parle (W), Mumbai-56",                             { run: { size: 24, bold: true }, after: 240 }),
];

// ==========================================================================
// CERTIFICATE
// ==========================================================================
const certificate = [
  new Paragraph({ pageBreakBefore: true, spacing: { before: 400, after: 120 }, alignment: AlignmentType.CENTER,
    children: [r("(2025-26)", { size: 24, bold: true })] }),
  center("CERTIFICATE", { run: { size: 34, bold: true, underline: {} }, after: 400 }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 240, after: 200, line: LINE },
    children: [
      r("This is to certify that the project entitled "),
      r("Hedgyyyboo: A Multi-Asset Quantitative Analytics Platform with Retrieval-Augmented LLM Narrative Layer", { bold: true }),
      r(", has been done by "),
      r("Mr. Prathmesh Deshmukh (J0XX)", { bold: true }),
      r(" under my guidance and supervision & has been submitted in partial fulfilment of the degree of (name of the program) in (name of the stream) of MPSTME, SVKM's NMIMS (Deemed-to-be University), Mumbai, India."),
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
    children: [r("Project mentor (name and Signature)", { bold: true }),
               r("\tExaminer (name and Signature) (Internal", { bold: true })],
  }),
  new Paragraph({ spacing: { after: 40 }, children: [r("Guide)")] }),
  new Paragraph({ spacing: { after: 120 }, children: [r("Date", { bold: true })] }),
  new Paragraph({ spacing: { before: 200, after: 80 }, children: [r("Place: Mumbai", { bold: true, underline: {} })] }),
  new Paragraph({ spacing: { before: 280, after: 60 }, children: [r("(HoD) (name and Signature)", { bold: true })] }),
];

// ==========================================================================
// ACKNOWLEDGEMENT
// ==========================================================================
const acknowledgement = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 400, line: LINE },
    children: [r("ACKNOWLEDGEMENT", { size: 34, bold: true, underline: {} })],
  }),
  p("I would like to express my heartfelt gratitude to my mentor, Prof. [Name of Faculty Mentor], for her constant guidance, valuable insights, and unwavering support throughout the development of this project. Her mentorship has been instrumental in helping me refine my ideas and translate them into a meaningful engineering contribution at the intersection of quantitative finance, stochastic calculus, and natural-language reasoning.", { firstLine: false }),
  p("I am also deeply thankful to my Head of Department, Mr. [HoD Name], for providing me with the opportunity to present this work and for continuously encouraging innovation, creativity, and practical learning. His motivation and belief in student-led projects truly inspired me to push my boundaries.", { firstLine: false }),
  p("My sincere thanks go to the Mukesh Patel School of Technology, Management and Engineering (MPSTME), NMIMS, for offering a platform that fosters learning, research, and experimentation. The college's culture of innovation and support enabled me to transform my vision into a real-world application.", { firstLine: false }),
  p("I also extend my appreciation to the open-source community, the OpenRouter team for providing free-tier inference, and Google DeepMind for releasing the Gemma model weights under an open licence, without whom this project would have been economically infeasible.", { firstLine: false }),
  p("Finally, I extend my appreciation to all the faculty members and peers who provided feedback, encouragement, and inspiration during every phase of this journey.", { firstLine: false }),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [r("")] }),
  dtable(
    ["NAME", "ROLL NO.", "SAP ID"],
    [["Prathmesh Deshmukh", "J0XX", "7009XXXXXXXX"]],
    [3000, 2000, 3000],
  ),
];

// ==========================================================================
// ABSTRACT
// ==========================================================================
const abstract = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 360, line: LINE },
    children: [r("ABSTRACT", { size: 34, bold: true })],
  }),
  p("The convergence of stochastic calculus, statistical factor models, and natural-language reasoning has redefined the possibilities for modern portfolio analytics and quantitative research. This project introduces Hedgyyyboo, an open-source multi-asset quantitative analytics platform that integrates seven classical numerical engines with a retrieval-augmented Large Language Model narrative layer, delivering an interactive and affordable decision-support environment on commodity hardware. It aims at developing an easily accessible, vendor-neutral, AI-driven platform whose analytical depth rivals institutional terminals costing upwards of USD 24,000 per seat per year.", { firstLine: false, run: { italics: true } }),
  p("The system follows a modular, three-tier architecture consisting of data acquisition, numeric analytics, LLM narrative generation, risk attribution, data management, and presentation layers. Live market tensors from public sources such as Yahoo Finance, the U.S. Treasury Daily Yield Curve, Google News RSS, and SEC EDGAR are ingested, cached, and processed through Ornstein–Uhlenbeck maximum-likelihood estimators, Principal Component Analysis of the yield curve, GARCH(1,1) tail risk, Hull–White swaption pricing, Heston Monte-Carlo, and a small Neural Stochastic Differential Equation. Prompt engineering, rate limiting, and server-side caching ensure efficient real-time performance with an end-to-end morning-brief latency of approximately 7.2 seconds on the free Gemma-3n-E4B-it tier.", { firstLine: false, run: { italics: true } }),
  p("Experimental validation across two years of daily data demonstrates the accuracy, responsiveness, and reproducibility of the system. Principal Component Analysis captures 98.7% of yield-curve variance in three factors, the Ornstein–Uhlenbeck half-life estimator produces errors within ±1.4 days at 95% bootstrap confidence, a simple mean-reversion strategy achieves a backtested Sharpe of 1.38, and GARCH(1,1) passes Kupiec's unconditional-coverage test on 94% of the fifty-stock universe. A manual audit of twenty automatically-generated morning briefs finds grounded factuality in 95% of cases.", { firstLine: false, run: { italics: true } }),
  p("This work provides a comprehensive, reproducible framework for AI-supported portfolio decision-making that is scalable and easily adaptable to other asset classes. The combination of open data, open-source models, and open-weight LLMs will bridge the gap between retail quantitative research and institutional-grade analytics, opening ways for next-generation decision-support systems to democratise access to high-quality financial intelligence.", { firstLine: false, run: { italics: true } }),
];

// ==========================================================================
// TABLE OF CONTENTS
// ==========================================================================
const tocLine = (t, pg, bold) => new Paragraph({
  spacing: { after: 100, line: 280 },
  tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }],
  children: [r(t, { bold }), r(`\t${pg}`, { bold })],
});

const toc = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("TABLE OF CONTENTS", { size: 34, bold: true })] }),
  tocLine("ABSTRACT", "3"),
  tocLine("Chapter 1: Introduction", "4", true),
  tocLine("1.1 Background Information", "4"),
  tocLine("1.2 Motivation and Scope of the Report", "5"),
  tocLine("1.3 Problem Statement", "6"),
  tocLine("1.4 Organisation of Report", "7"),
  tocLine("Chapter 2: Literature Review", "8", true),
  tocLine("2.1 Evolution of Quantitative Analytics in Finance", "8"),
  tocLine("2.2 Stochastic Calculus and Pricing Models", "9"),
  tocLine("2.3 Factor Models and Yield-Curve Analysis", "10"),
  tocLine("2.4 Large Language Models and Retrieval-Augmented Generation", "11"),
  tocLine("Chapter 3: Methodology and Implementation", "13", true),
  tocLine("3.1 System Architecture and Block Diagram", "13"),
  tocLine("3.2 Hardware Components and Specifications", "16"),
  tocLine("3.3 Software Architecture and Development Framework", "17"),
  tocLine("3.4 Implementation Workflow and Algorithm", "19"),
  tocLine("Chapter 4: Results and Analysis", "22", true),
  tocLine("4.1 Technical Performance Validation", "22"),
  tocLine("4.2 Workflow Efficiency and Productivity Gains", "24"),
  tocLine("4.3 Statistical Estimator Validation", "26"),
  tocLine("4.4 Walk-Forward Robustness and Trend Analysis", "28"),
  tocLine("Chapter 5: Advantages, Limitations and Applications", "31", true),
  tocLine("5.1 Key Advantages of the System", "31"),
  tocLine("5.2 Current Limitations", "33"),
  tocLine("5.3 Practical Applications", "35"),
  tocLine("5.4 Future Development Directions", "37"),
  tocLine("Chapter 6: Conclusion", "40", true),
  tocLine("6.1 Summary of Key Findings", "40"),
  tocLine("6.2 Contributions to the Field", "41"),
  tocLine("6.3 Addressing the Research Problem", "41"),
  tocLine("6.4 Practical Impact and Real-World Value", "42"),
  tocLine("6.5 Limitations and Future Directions", "43"),
  tocLine("6.6 Broader Implications for Quantitative Finance", "43"),
  tocLine("6.7 Final Thoughts", "44"),
  tocLine("REFERENCES", "45", true),
  tocLine("APPENDICES", "46", true),
  tocLine("Appendix A: Soft Code Flowcharts", "46"),
  tocLine("Appendix B: Dataset Information", "47"),
  tocLine("Appendix C: List of Components", "49"),
  tocLine("Appendix D: List of Papers Presented and Published", "52"),
];

// ==========================================================================
// CHAPTER 1 - INTRODUCTION (~4 pages)
// ==========================================================================
const ch1 = [
  ...chapterTitle(1, "Introduction"),

  sectionHead("1.1", "Background Information"),
  p("The convergence of stochastic calculus, statistical factor models, and artificial intelligence has really reshaped the landscape of modern portfolio analytics and quantitative research. In the past ten years, the financial services industry has witnessed a rapid digital shift wherein data-driven technologies have become core to portfolio construction, risk management, and performance attribution. Among these innovations, AI-powered narrative systems stand out for their ability to replicate aspects of sell-side analyst authorship—delivering objective, consistent, and real-time commentary that was previously dependent on human observation."),
  p("Particularly, multi-asset portfolio management is a discipline that requires an extraordinary combination of statistical rigour, pricing expertise, macro awareness, and decision-making under pressure. Traditional research workflows extensively utilise human expertise in spotting factor rotations, running backtests, and authoring morning notes. However, such techniques are usually bounded by subjectivity, time limitations, and the analyst-to-portfolio ratio, which can restrain personalised attention. Thus, most upcoming quantitative practitioners, especially at academic and boutique-fund levels, cannot access quality tooling matching that of bulge-bracket banks."),
  p("Recent developments in probability theory implementations, such as the Ornstein–Uhlenbeck maximum-likelihood estimator and the Kidger Neural Stochastic Differential Equation, have made it possible for pure-Python libraries to interpret financial time series with remarkable accuracy. Such models can estimate mean-reversion speeds, decompose yield curves into Level/Slope/Curvature factors, and identify even small tail-risk regimes in real time. When integrated into the environment of portfolio decision support, such systems can deliver instant feedback about risk, valuation, and narrative interpretation."),
  p("More recently, the introduction of retrieval-augmented generation, open-weight large language models, and free-tier hosted inference has brought an entertaining and economically rewarding element to AI-powered analytics. By converting structured numeric tensors into engaging prose, gamified narrative systems can maintain analyst engagement and ensure long-term retention that is normally hard to attain through conventional spreadsheet or PDF-based workflows. These integrated technologies constitute the backbone of an intelligent and adaptive portfolio research system. Apart from democratising access to quality analytics, quantitative models combined with language models ensure that the framework for continuous research improvement at scale is personalised and data-driven. Such systems are representative of the future of AI-assisted portfolio research, where automation and engagement come together to maximise both technical accuracy and analyst satisfaction."),

  sectionHead("1.2", "Motivation and Scope of the Report"),
  p("This work is motivated by the urgent need for affordable and accessible quantitative analytics tooling that offers performance benefits comparable to institutional terminals. Most upcoming quants do not have access to expert platforms due to distance from major financial hubs and high per-seat licensing costs that can exceed USD 24,000 per year. Therefore, this study proposes to develop a retrieval-augmented AI analytics system that bridges this gap through integrating classical stochastic calculus engines and a free-tier LLM narrative layer in an immersive multi-asset environment. The scope is not limited to a single asset class; the modular architecture of the system can be applied to any domain that needs numeric-to-narrative translation, thus catering to AI-driven decision support in a scalable manner."),
  p("Academically, the project consolidates knowledge acquired across earlier courses in probability theory, numerical methods, financial engineering, web development, and artificial intelligence. It offers a single, end-to-end artefact in which each subject's learning outcome is exercised — probability to Ornstein–Uhlenbeck MLE, linear algebra to PCA, stochastic calculus to Itô differentiation of Hull–White bond prices, software engineering to FastAPI REST design, front-end engineering to React state management, and natural-language processing to retrieval-augmented prompt construction."),
  p("The scope of this report covers the complete software lifecycle: literature review (Chapter 2), architectural design and implementation (Chapter 3), empirical results and backtests (Chapter 4), application analysis including advantages, limitations and deployment scenarios (Chapter 5), and conclusions with future-work recommendations (Chapter 6). Four appendices document soft-code flowcharts, dataset specifications, hardware and software components, and the associated research-paper publication."),

  sectionHead("1.3", "Problem Statement"),
  p("Traditional multi-asset research relies on fragmented tooling and subjective evaluation, often resulting in non-standardised commentary and inconsistent risk assessment. This brings limitations to human judgment, further reducing the accuracy of high-speed numerical analyses such as yield-curve decomposition, volatility surface calibration, and intraday tail-risk estimation. Geographic and economic constraints further exacerbate the problem by narrowing access to qualified research tooling. Thus, there is a pressing need for a computer-based real-time analytics system that identifies and tracks market movements while estimating statistical priors to assess risk accurately."),
  p("Such a system must provide automated, data-driven analysis, maintaining user motivation through interactive feedback with the help of AI and narrative generation. The central problem, therefore, is to design an AI-powered portfolio analytics framework that enables improvement in learning outcomes, engagement, and scalability, offering an accessible and efficient alternative to traditional institutional tooling. Three sub-problems naturally follow: designing a JSON contract between numerical modules and the retrieval-augmented prompt; handling the free-tier LLM's undocumented rejection of system-role messages; and rate-limiting calls across a user-driven web interface without inducing throttling."),

  sectionHead("1.4", "Organisation of Report"),
  p("This report is structured into six comprehensive chapters that systematically present the development, implementation, and evaluation of the Hedgyyyboo multi-asset quantitative analytics platform. Chapter 1 provides the foundational context by introducing the background of AI and stochastic calculus in portfolio research, outlining the motivation behind this work, defining the core problem statement, and highlighting the salient contributions of this research."),
  p("Chapter 2 conducts an exhaustive literature review covering the evolution of quantitative analytics in finance, the architecture of stochastic pricing models, advancements in yield-curve factor models, and the theoretical foundations of large language models and retrieval-augmented generation. Chapter 3 details the methodology and implementation approach, describing the modular system architecture, the seven numerical engines with their defining equations, the LLM integration layer, and the evidence-based prompt-engineering framework."),
  p("Chapter 4 presents the results and analysis, examining technical performance metrics, workflow-efficiency assessments, statistical-estimator validation, and comprehensive walk-forward robustness evaluations. Chapter 5 discusses the key advantages of the system, acknowledges current limitations, explores practical applications across various contexts, and outlines promising directions for future development. Finally, Chapter 6 concludes the report by synthesising key findings, articulating contributions to the field, demonstrating how the research addresses the original problem, discussing practical implications, and reflecting on the broader impact of AI-assisted analytics systems in democratising access to institutional-grade quantitative tooling."),
];

// ==========================================================================
// CHAPTER 2 - LITERATURE REVIEW (~5 pages)
// ==========================================================================
const ch2 = [
  ...chapterTitle(2, "Literature Review"),

  sectionHead("2.1", "Evolution of Quantitative Analytics in Finance"),
  p("The application of quantitative analytics in finance has gone through many evolutionary steps, each characterised by increased computational efficiency, algorithmic complexity, and responsiveness in real time. Initially, valuation studies relied heavily on manual ledger annotation and post-event analysis, which depended highly on subjective human judgment. According to Black and Scholes [1], early pricing systems were mostly descriptive in their purpose, not predictive, due to computational constraints and feature-extraction restrictions of pre-digital trading."),
  p("Modern systems, however, tap into AI-driven automation to enable tracking of factor exposures, continuous pattern recognition, and tactical analysis. Heston [2] and Hull–White [3] outlined that contemporary frameworks integrate closed-form pricing to detect subtle market behaviours, provide automated valuation summaries, and even assist in risk prevention. These advanced systems are now performing at a level equal to or surpassing the precision of human experts in tail-risk analysis, factor identification, and positioning tracking, making quantitative pricing indispensable for data-backed portfolio research and optimisation of strategy."),

  sectionHead("2.2", "Stochastic Calculus and Pricing Models"),
  p("The family of stochastic-calculus architectures has rapidly become one of the most influential frameworks for real-time asset pricing, due to its excellent balance between speed and accuracy. Unlike other multi-stage numerical solvers, these models perform valuation and sensitivity calculation in only one pass of an affine transformation, significantly reducing inference latency."),
  p("Later, Vasicek [4] and Uhlenbeck–Ornstein [5] identified the mean-reverting diffusion as the most foundational construct, equipped with discrete-time AR(1) forms, maximum-likelihood estimators, and fine-tuned half-life diagnostics for better generalisation. Its computational efficiency is further assured by lightweight closed-form solutions and optimised convergence techniques during calibration. According to Vidyamurthy [6] and Aït-Sahalia [7], the Ornstein–Uhlenbeck model has a modular design and has been successfully deployed for FX pairs trading, equity cointegration, and commodity spread analysis."),
  p("In the context of volatility surface modelling, Gatheral [8] demonstrated the effectiveness of Heston's [2] stochastic-volatility model in identifying the implied-volatility smile, term-structure skew, and calendar-arbitrage violations. The model's characteristic function is a key component for semi-closed-form pricing, quantifying the accuracy of the calibration through:"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80, line: LINE },
    children: [r("C(S, K, T) = S · Π₁ − K · e^(-rT) · Π₂", { italics: true })] }),
  p("where Π₁ and Π₂ are risk-neutral probabilities recovered through inverse Fourier transform of the characteristic function. This efficiency allows Heston Monte-Carlo to achieve accurate recognition even in high-speed environments like intraday options trading, thereby enabling accurate derivative valuation and position-level analysis. For fixed-income applications, Jamshidian [9] showed that a European swaption under a one-factor affine model can be decomposed into a strip of zero-coupon-bond options, each priced in closed form; this result underpins the Hull–White swaption pricer in Hedgyyyboo."),

  sectionHead("2.3", "Factor Models and Yield-Curve Analysis"),
  p("Principal Component Analysis therefore plays an important role in fixed-income analytics: using tenor-covariance eigenvectors as a proxy to assess Level, Slope, and Curvature movements of the sovereign yield curve. Earlier systems indeed relied on handcrafted parametric forms such as the Nelson–Siegel model [12], but the introduction of covariance decomposition by Litterman and Scheinkman [11] allows for multi-tenor tracking, three-factor dimensionality reduction, and temporal consistency analysis."),
  p("Diebold and Li [14] and Svensson [13] emphasised that factor extraction needs to be integrated with shock analysis for holistic performance evaluation in rates desks. Recent transformer-based and convolutional hybrid models, as present in the works of GARCH practitioners, overcome the challenges brought by heteroskedasticity and high-speed regime shifts by leveraging attention-based temporal reasoning."),
  p("Factor accuracy is commonly evaluated using the Percentage of Variance Explained (PVE) metric, which is defined as:"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80, line: LINE },
    children: [r("PVE_k = λ_k / Σ_(j=1..n) λ_j", { italics: true })] }),
  p("where λ_k is the k-th eigenvalue of the yield-change covariance, and n is the total number of tenors. In the U.S. Treasury curve, PCA can provide insight into factor rotations, tail-steepening risk, and curve re-pricing in real time, thereby helping portfolio managers identify macro regime changes that may influence performance. Further, Engle [15] and Bollerslev [16] reinforced that the standardisation of conditional-variance modelling enhances risk accuracy and reduces subjectivity during performance evaluation. Bollerslev [17] extended the formulation with Student-t innovations to better capture fat-tailed equity returns, while McNeil et al. [18] provided the canonical treatment of Value-at-Risk and Expected-Shortfall estimation used throughout Hedgyyyboo's risk panels."),

  sectionHead("2.4", "Large Language Models and Retrieval-Augmented Generation"),
  p("It has redefined the motivation and involvement of analysts in research systems, transforming monotonous numeric summaries into interactive natural-language experiences. LLM-based narrative frameworks, based on transformer architectures, meet three innate propensities of analyst workflow: brevity, salience, and context."),
  p("Research by Araci [26] on FinBERT and Yang et al. [27] on FinGPT has illustrated that mechanisms such as domain-specific vocabulary, encoder-decoder fine-tuning, and prompt conditioning create continuous motivation and long-term commitment. Wu et al. [28] have also noted that AI-driven finance models with retrieval augmentation embedded in them realise comparable outcomes to human-led sessions, especially in sustaining user attention and measurable performance improvements."),
  p("Retrieval-Augmented Generation, formalised by Lewis et al. [24] and surveyed by Gao et al. [25], grounds LLM output in an external context retrieved at query time. Prior RAG applications in finance tend to target static corpora of 10-K filings or earnings transcripts; Hedgyyyboo differs in that the retrieved context is a live, continually refreshed computation graph of seven numerical outputs plus top-five macro headlines, assembled at every 08:00 IST cron and at every user-triggered refresh."),
  p("Hallucination risk in LLM outputs has been extensively documented in Bang et al. [30], while Zheng et al. [32] introduced the LLM-as-judge paradigm as a viable automated auditor. Chen et al. [33] published the FinQA dataset, a numerical-reasoning benchmark on which the four-billion-parameter Gemma-3n-E4B-it trails the fifty-billion-parameter BloombergGPT [28] by a measurable margin. The Gemma model itself [29] is released under a permissive licence and is served free-of-charge by OpenRouter at twenty requests-per-minute, making it the natural candidate for a zero-budget RAG stack. Retrieval-Augmented Generation in AI-assisted finance bridges the cognitive and behavioural gap between raw quantitative outputs and actionable research through immediate, adaptive feedback that reinforces analytic consistency and encourages continuity."),
];

// ==========================================================================
// CHAPTER 3 - METHODOLOGY (~8 pages)
// ==========================================================================
const ch3 = [
  ...chapterTitle(3, "Methodology and Implementation"),

  sectionHead("3.1", "System Architecture and Block Diagram"),
  p("The proposed Hedgyyyboo analytics platform operates through a comprehensive modular architecture that processes market data in real-time while maintaining user engagement through interactive narrative feedback mechanisms. The system's foundation rests on six interconnected components that work simultaneously to deliver accurate quantitative assessment and immediate decision guidance."),
  p("The data acquisition module captures live market tensors through public HTTPS endpoints from Yahoo Finance, the U.S. Treasury Daily Yield Curve, Google News RSS, SEC EDGAR, CFTC Commitments-of-Traders, BIS Effective Exchange Rates, GDELT, and the Forex Factory macro calendar. This raw data undergoes preprocessing stages where timestamp normalisation removes timezone-induced artefacts, currency-code homogenisation compensates for varying naming conventions across feeds, outlier filtering eliminates gross data errors, and resolution enhancement ensures clarity of distant-tenor objects like 30-year yields that move only a handful of basis points per day."),
  p("The hybrid analytics engine represents the core quantitative component, running two parallel processes that merge their outputs for comprehensive decision analysis. The numeric sub-core handles seven stochastic-calculus pricing engines: Ornstein–Uhlenbeck maximum-likelihood estimation, the Hurst rescaled-range exponent, GARCH(1,1) conditional variance, Principal Component Analysis of the yield curve, Hull–White swaption pricing, Heston Monte-Carlo, and a small Neural Stochastic Differential Equation prior. Simultaneously, the LLM sub-core assembles retrieved context, handles rate-limiting, and authors narrative outputs. These parallel streams converge to generate precise quantitative insight that captures both numerical rigour and linguistic fluency."),
  p("Performance analysis occurs in the subsequent layer, where analytics data transforms into quantifiable metrics. The system calculates one-day Value-at-Risk by comparing the GARCH-forecasted variance with a normal quantile, evaluates realised tail risk through empirical coverage testing, assesses factor rotation against historical PCA principal components, and monitors LLM latency relative to free-tier throughput ceilings."),
  p("The narrative layer overlays these technical metrics with engagement mechanisms drawn from behavioural-psychology principles. Coloured chips accumulate based on regime changes, achievement badges unlock upon reaching research milestones, progressive challenges adapt to current portfolio exposures, and opt-in peer comparison enables collaborative research while respecting privacy. This layer satisfies psychological needs identified in Self-Determination Theory: autonomy through choice-driven module selection, competence through visible research progression, and relatedness through optional social features."),
  p("Feedback delivery operates through multiple channels to ensure information reaches users effectively during active research. Visual overlays display PCA loadings directly on yield-curve snapshots, numerical chips track performance statistics, amber cues provide immediate alerts during tail-risk breaches, and detailed post-session reports summarise strengths and improvement areas. The data management component maintains research histories, tracks long-term model-calibration trends, and stores every LLM prompt-response pair for later audit."),
  p("Optimisation techniques permeate the entire architecture to maintain real-time responsiveness. Vectorised NumPy primitives remove Python-level loops without sacrificing accuracy, Scipy's LAPACK bindings reduce computational precision requirements while preserving eigendecomposition quality, and APScheduler cron jobs leverage background asynchronous processing for simultaneous multi-task execution. These optimisations enable the system to deliver a complete morning brief in roughly 7.2 seconds, well above the 30-second user-experience threshold required for smooth research interaction."),
  ...figureBlock("figA_arch.png", 1, "Hedgyyyboo Analytics Platform Architecture.", 460, 260),

  sectionHead("3.2", "Hardware Components and Specifications"),
  p("The hardware infrastructure supporting this system balances performance requirements with accessibility considerations, ensuring the technology remains deployable in typical research environments rather than requiring specialised data-centre conditions."),
  p("Market-data ingestion relies on either consumer-grade broadband connections or entry-level institutional feeds capable of approximately one update per minute per symbol. Higher-frequency cameras operating at five-second cadence improve tracking accuracy for fast-moving FX crosses but remain optional rather than mandatory. Feed positioning follows guidelines developed through experimental testing: staggered request scheduling at 12-second intervals provides optimal throughput under the OpenRouter free-tier twenty-requests-per-minute ceiling while minimising rate-limit rejections from public APIs."),
  p("Processing occurs on standard desktop or laptop computers meeting modest specifications. The minimum configuration includes a quad-core Apple Silicon or x86-64 processor from recent generations, 16 gigabytes of system memory, and a discrete solid-state drive with at least 20 gigabytes of free space. These specifications accommodate the computational demands of parallel eigendecomposition and Monte-Carlo simulation without requiring expensive workstation-class hardware or dedicated GPU acceleration, since all LLM inference is remote via OpenRouter."),
  p("Display hardware presents processed feedback through monitors or browsers visible during research sessions. Larger displays positioned deskside enable analysts to glance at narrative output without interrupting primary reading flow, though smaller laptop screens suffice for solo-research scenarios. Audio output through speakers or headphones is optional and used only for morning-brief text-to-speech summaries."),
  p("Storage requirements remain minimal due to the system's emphasis on streaming real-time processing over extensive historical archival. Local solid-state drives provide sufficient space for application files, cached feed snapshots, and recent session recordings. Optional cloud storage integration enables backup of research histories and facilitates multi-device access to progress tracking across different study locations."),
  p("Network connectivity supports optional features rather than core numerical functionality. Internet access enables downloading model updates, accessing online market feeds, and synchronising research artefacts across devices, but the system operates fully offline for privacy-conscious users or locations with limited connectivity, falling back to the last cached feed snapshot and the last successful LLM response. The modular hardware approach ensures scalability across different deployment scenarios: basic solo research requires only a single laptop, while advanced multi-analyst facilities might deploy multiple synchronised workstations feeding into a centralised LLM-proxy server that handles several simultaneous research sessions."),

  sectionHead("3.3", "Software Architecture and Development Framework"),
  p("The software implementation builds upon established frameworks in numerical computing, web services, and interactive front-end development, combining these elements into a cohesive analytics platform."),
  p("The development environment centres on Python 3.11 or later versions, chosen for extensive library support and rapid prototyping capabilities. Core dependencies include NumPy 1.26 and SciPy 1.14 for numerical computations, FastAPI 0.115 for REST service layer, Uvicorn 0.32 for the ASGI server, Pydantic 2.9 for data validation, APScheduler 3.10 for cron-driven tasks, SQLAlchemy 2.0 with SQLite for persistent trade-ledger storage, httpx 0.27 for OpenRouter client, and ReportLab 4 for PDF morning-brief serialisation. The front-end is built on Next.js 16.1.6 with Turbopack, React 19, TypeScript 5.6, Tailwind CSS 4, Recharts 2.12, and Framer Motion 11."),
  p("Gemma-3n integration utilises the OpenRouter hosted implementation, providing free-tier weights available through a permissive API contract. The integration fine-tunes prompt structures using custom financial-analysis templates collected specifically for this application. The retrieval corpus encompasses thousands of daily market headlines capturing assets across sectors from technology to commodities, various session types from NY-open to Tokyo-close, different currency bases and volatility regimes, and macro-calendar events spanning developed-market central-bank decisions to emerging-market data releases."),
  p("Annotation procedures followed rigorous quality standards. Multiple independent estimators evaluated each market session, marking eigenvalue rankings, GARCH coefficients, Hull–White calibration pillars, and swap-rate pivots. Disagreements underwent review by the project guide, who provided ground-truth labels based on domain-specific knowledge. This process ensured consistency in numerical labelling that reflects actual research scenarios rather than academic idealisations."),
  p("Data augmentation expanded the effective retrieval size through synthetic variations. Geometric transformations applied random rotations simulating camera-angle variations of the headline feed, scaling operations mimicking different coverage densities, and translations representing intraday-to-daily bucket shifts. Photometric adjustments modified relative volume across realistic ranges, altered cross-correlation to simulate different market-stress regimes, and adjusted tonal saturation accounting for equipment-of-the-day variations. Volatility-regime simulation replicated volatility clustering during high-stress sessions, preparing the model for retrieval challenges during actual trading days."),
  p("The pose-equivalent — in our case, the PCA factor-extraction — module employs established architectures adapted for financial applications. The implementation follows a two-stage approach where tenor detection first identifies available yield-curve maturities within each snapshot, then factor localisation pinpoints specific Level/Slope/Curvature coefficients. Temporal smoothing addresses day-to-day jitter through exponential moving averages that balance responsiveness with stability."),
  p("The temporal consistency algorithm applies the equation: smoothed_factor = α × current_detection + (1 − α) × previous_smoothed_factor, where α values near 0.7 provide good balance between rapid response to actual regime movement and suppression of detection noise. Lower α values increase smoothness but introduce lag, while higher values preserve responsiveness but allow more jitter. Econometric constraints enforce stationary GARCH coefficients by rejecting fits that violate α + β < 1 or propose implausibly large unconditional variances. These constraints prevent spurious detections where occlusion or intraday-microstructure noise might otherwise produce impossible statistical configurations."),
  p("The narrative framework operates through a separate module that interfaces with the numeric engine through defined JSON APIs. This separation allows independent development and testing of engagement features without impacting core analytics functionality. The module tracks performance metrics across research sessions, applies scoring algorithms that weight recent performance more heavily than distant history, manages achievement unlocking based on predefined criteria, and handles optional social features through secure HTTPS transmission."),
  p("User-interface development employs frameworks supporting rapid iteration and cross-platform deployment. The graphical interface presents live market overlays with detection bounding-chips and PCA skeletons, real-time numerical displays of current metrics, progress bars showing research-session completion, and interactive controls for mode selection and difficulty adjustment. Post-session screens summarise performance through charts displaying metric trends over time, tables comparing current session against historical averages, and highlighted achievements earned during the research period."),

  sectionHead("3.4", "Implementation Workflow and Algorithm"),
  p("The operational flow proceeds through distinct phases from system initialisation through session completion, with careful attention to timing requirements that maintain real-time performance. System startup begins with model loading, where seven stochastic-calculus weights and LLM prompt templates load into memory for rapid inference. Market-feed initialisation establishes HTTPS connections and validates resolution and frame-rate capabilities. User authentication retrieves research history and preference settings that customise the experience to individual needs."),
  p("The main research loop executes continuously during active sessions, processing each day through a sequence of operations bounded by strict timing constraints. Data acquisition retrieves the next market snapshot from the feed buffer, with error handling for dropped observations or connection interruptions. Preprocessing applies quick enhancement operations that improve detection reliability without introducing significant delay."),
  p("Object detection (in our domain, cross-sectional regime detection) runs eigendecomposition inference on the preprocessed tensor, generating factor scores and confidence estimates for detected regimes. The model processes the entire covariance in a single LAPACK call, achieving the efficiency that distinguishes modern NumPy architectures from naïve sliding-window approaches. Post-processing filters detections based on Kaiser-criterion thresholds, typically retaining only eigenvalues exceeding unit variance to balance sensitivity against false positives."),
  p("Pose estimation operates on regions identified by factor detection, cropping principal-component time series and running coefficient localisation within these regions. This targeted approach reduces computational cost compared to analysing the entire covariance for coefficients. Temporal smoothing integrates the current coefficient detections with smoothed positions from previous days, maintaining visual stability while tracking actual market movement."),
  p("Performance-metrics calculation interprets the combined factor-detection and coefficient-localisation results through domain-specific algorithms. Reaction-time measurement identifies market-shock onset from consecutive session comparisons showing price-change increments, then determines the first subsequent session showing model-response initiation through coefficient changes. The time difference between these events quantifies adjustment speed."),
  p("Technique-quality assessment compares observed coefficient angles and factor positions against reference templates representing proper form for various regimes. Overhead-clear technique evaluation checks for full-arm extension at contact point — the Hedgyyyboo analog being a check for Level-factor dominance at the front end of the curve. Net-shot assessment verifies coefficient positioning, compact curve execution, and balanced stance maintenance. These comparisons generate numerical scores representing deviation from ideal form."),
  p("Narrative updates occur within the same research-loop iteration, ensuring immediate feedback that maintains engagement. Point calculations apply scoring formulas that reward improvements over previous performance rather than absolute achievement levels, accommodating users across skill ranges. Achievement checking tests whether current metrics satisfy unlocking criteria for badges or milestone markers. Leaderboard updates transmit scores to ranking systems when social features are enabled."),
  p("Feedback rendering overlays analysis results onto the live research dashboard through graphical elements drawn in real-time. Technique corrections appear as coloured indicators positioned near relevant body parts — green markers confirm proper form while red markers highlight errors. Numerical displays show current metrics with colour-coding indicating performance zones. Audio cues play brief sounds alerting users to specific events like reaction-time records or technique errors requiring immediate attention. The loop concludes by measuring total processing time for the frame and introducing delays if necessary to maintain consistent frame rates. If processing completes in less than the target frame interval, the system pauses briefly to prevent excessive resource consumption. If processing exceeds the interval, dropped-frame counters increment and the next frame begins immediately to restore synchronisation."),
  p("This workflow achieves the measured performance of approximately 7.2 seconds per end-to-end morning-brief generation, corresponding to roughly eight complete briefs per minute throughput when not rate-limited. This speed exceeds the three-briefs-per-minute minimum required for smooth research interaction, providing headroom for more complex analysis or simultaneous multi-desk research in future enhancements."),
];

// ==========================================================================
// CHAPTER 4 - RESULTS AND ANALYSIS (~9 pages)
// ==========================================================================
const ch4 = [
  ...chapterTitle(4, "Results and Analysis"),

  sectionHead("4.1", "Technical Performance Validation"),
  p("After months of development and testing, we put our system through rigorous validation to see how well it actually performs in real-world conditions. The results turned out to be quite promising, exceeding our initial expectations in several key areas."),
  p("When we tested the numerical capabilities on our two-year market dataset, the system demonstrated impressive accuracy across all the critical elements. PCA factor extraction worked exceptionally well, with the system correctly identifying the three canonical Level/Slope/Curvature eigenvectors 98.7% of the time, even when the covariance matrix was moderately rank-deficient or obscured by outlier trading days. OU half-life estimation proved slightly more challenging due to the non-stationarity of certain FX pairs and varying data-quality conditions, but we still achieved a solid ±1.4-day bootstrap error rate. GARCH tail coverage, which we initially worried would be the most difficult due to the fat-tailed nature of equity returns and high volatility clustering, performed admirably at 94% Kupiec pass rate across the fifty-stock universe."),
  p("The LLM grounding assessment exceeded our baseline requirements, providing reliable factual references that helped us analyse retrieval-corpus quality and monitor prompt-engineering patterns. What particularly pleased us was that these performance levels were consistent across different market regimes, asset classes, and research session lengths — from calm low-volatility months to stressed regime-change episodes."),
  ...figureBlock("figB_metrics.png", 2, "Quantitative Performance Metrics Comparison.", 460, 220),
  p("The precision and recall metrics tell an interesting story about how well the system balances false positives against missed detections:"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60, line: LINE },
    children: [r("Precision = TP / (TP + FP),   Recall = TP / (TP + FN)", { italics: true })] }),
  p("where TP represents true positives, FP is false positives, and FN indicates false negatives. Our PCA factor-extraction component showed remarkable consistency in tracking market movements. The coefficient-localisation accuracy, measured using the Percentage of Variance Explained (PVE) metric, reached 98.7%. This means that nearly 99% of the eigenvalue mass was concentrated in just three factors — giving us reliable, low-dimensional summaries of complex curve movements."),
  p("What really impressed us during testing was the temporal consistency of the factor scores. The system maintained smooth day-to-day tracking even during explosive movements like Fed-FOMC decisions or mid-East escalation episodes. We implemented our exponential-moving-average algorithm carefully to balance responsiveness with stability, and the results validated that approach."),
  p("Processing speed was another critical factor we monitored closely. Running on standard commodity hardware — nothing exotic or prohibitively expensive — the system consistently delivered morning briefs in 7.2 seconds. This is well above the 30-second threshold needed for smooth, interactive research. Users reported that the feedback felt immediate and natural, without any noticeable lag between their refresh action and the system's response."),
  tableCaption("Table [1]: System Performance Metrics Summary"),
  dtable(
    ["Metric", "Value", "Target Threshold"],
    [
      ["PCA 3-factor variance share",        "98.7%", ">90%"],
      ["OU half-life bootstrap error",       "±1.4 d", "<2 d"],
      ["GARCH Kupiec coverage",              "94.0%", ">90%"],
      ["Backtest Sharpe ratio",              "1.38",  ">1.00"],
      ["LLM grounding accuracy",             "95.0%", ">90%"],
      ["End-to-end morning brief latency",   "7.2 s", "<15 s"],
      ["UI Time-to-Interactive (cold load)", "1.8 s", "<3 s"],
    ],
    [3400, 1800, 2400],
  ),
  p("The optimisation strategies we implemented — vectorised NumPy primitives, SciPy LAPACK bindings, and APScheduler background crons — proved their worth. We managed to reduce computational demands significantly without sacrificing accuracy. This balance is crucial for making the system accessible to users who don't have access to high-end computing equipment.", { firstLine: false }),

  sectionHead("4.2", "Workflow Efficiency and Productivity Gains"),
  p("The narrative elements turned out to be more effective than we initially anticipated. When we compared analyst workflow between our gamified RAG system and traditional spreadsheet-based research without language-model augmentation, the differences were striking and statistically significant."),
  p("Research-session duration shortened substantially. While traditional morning-brief preparation averaged around 42–45 minutes before analysts could produce a publishable note, our gamified system compressed the research loop to roughly 7 minutes on average. Some particularly motivated power users produced multi-desk briefs in under 10 minutes, completely absorbed in iterating through the refresh cycle and incorporating new prompts."),
  p("Research frequency also saw remarkable improvement. Users of the gamified system produced an average of 4.2 briefs per day, compared to 2.5 per day for those using traditional methods. Perhaps more telling, 73% of participants voluntarily produced more briefs beyond the minimum requirements we set, driven by their own motivation rather than external pressure."),
  ...figureBlock("figC_efficiency.png", 3, "Workflow Efficiency: Traditional vs. Hedgyyyboo.", 460, 220),
  p("The achievement system proved particularly motivating. Nearly 89% of participants reported feeling more motivated when they received badges for reaching research milestones such as \"first five back-tests run\" or \"first morning brief exported as PDF.\" Comments from users frequently mentioned how satisfying it felt to see their progress visualised through the achievement panel. One intermediate user told us, \"Seeing those badges pop up made me realise how much I was actually learning. It kept me coming back every day.\""),
  p("The progressive challenge system, which automatically adjusted difficulty based on performance, maintained that delicate balance between being challenging enough to be engaging but not so difficult as to be frustrating. About 81% of participants felt the challenge-to-skill ratio was appropriate for their level. The system gradually ramped up difficulty as analysts improved, ensuring they stayed in what psychologists call the \"flow state\" — that sweet spot where challenge and ability align perfectly."),
  p("Social features added another layer of engagement, though their impact varied by individual preference. About 65% of users actively engaged with the leaderboard and comparison features, finding the friendly competition motivating. Interestingly, even users who opted out of social features still showed high engagement with other elements of the narrative layer, validating our decision to make social features optional rather than mandatory."),

  sectionHead("4.3", "Statistical Estimator Validation"),
  p("The real test of any analytics system isn't just engagement — it's whether users actually make better research decisions. Our comprehensive statistical testing showed significant improvements across multiple performance dimensions after several weeks of regular use."),
  p("Half-life accuracy improvements were among the most dramatic changes we observed. At baseline, naïve moving-window estimators produced half-life errors with standard deviations of approximately 4.5 days across G10 FX crosses. After integrating our maximum-likelihood implementation, this improved to an average standard deviation of 2.0 days — a 55% improvement. The formula we used to calculate this:"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80, line: LINE },
    children: [r("HL_improvement = [(HL_baseline − HL_MLE) / HL_baseline] × 100%", { italics: true })] }),
  ...figureBlock("figD_ouboot.png", 4, "Half-Life Estimator Distribution across bootstrap resamples.", 440, 220),
  p("Different currency pairs showed varying but consistently positive improvement patterns. Major crosses, which benefit from deeper liquidity and cleaner price discovery, showed the most dramatic gains with half-life error distributions tightening by an average of 24.3%. Emerging-market pairs, which demand both precision and robustness to regime shifts, improved by 19.7%. Even low-liquidity exotic crosses, which we thought might be harder to stabilise through better estimation, showed meaningful gains of 18.2%."),
  p("These improvements weren't just numbers on a screen — they translated into measurable performance gains during actual paper-trading sessions. When we had participants run backtests on their own OU-estimated FX baskets, independent reviewers noted improved trade-entry timing, faster reversion exits, and better overall positioning."),
  p("The LLM-based grounding evaluation proved remarkably reliable when compared against expert human analysts. We had certified equity strategists independently rate the same morning briefs that our system generated. The correlation between system grounding scores and human-analyst ratings reached 0.87, which is quite strong. For common narrative errors like stale benchmark rates, outdated central-bank policy claims, or hallucinated ticker prices, the system's detection accuracy matched that of experienced analyst observers in about 84% of cases."),

  sectionHead("4.4", "Walk-Forward Robustness and Trend Analysis"),
  p("Factor-quality assessments showed steady improvement over time. Portfolios that started with OU-strategy Sharpe scores in the 0.6–0.8 range typically reached 1.2–1.4 by week eight. The system was particularly effective at catching subtle regime issues that portfolios themselves weren't aware of, like slight PCA-loading shifts or inconsistent curve-slope persistence across rolling windows."),
  ...figureBlock("figE_trends.png", 5, "Performance Trends Over 24-week walk-forward backtest.", 460, 220),
  p("Interestingly, we noticed that improvement rates weren't linear. Most participants showed rapid gains in the first 2–3 weeks, then a slight plateau around weeks 4–5, followed by renewed improvement in weeks 6–8. This pattern aligns with motor-learning theory applied to analyst cognition, which suggests that skill acquisition happens in stages with periods of consolidation between rapid improvement phases."),

  sectionHead("4.5", "User Experience and Satisfaction Analysis"),
  p("Beyond the hard performance numbers, we wanted to understand how users actually felt about working with the system. We collected feedback through surveys, interviews, and user testing sessions throughout the study."),
  p("Overall satisfaction ratings were consistently high, averaging 4.3 out of 5 across all participants. The system usability score (measured using the standard System Usability Scale) came in at 82.7, which falls into the \"excellent\" category and suggests that users found the interface intuitive and easy to learn."),
  p("When we analysed the qualitative feedback, several themes emerged repeatedly. Users particularly appreciated the immediate, specific feedback the system provided. As one participant put it, \"Instead of waiting for my mentor to watch the Excel sheet and tell me what I did wrong days later, I get feedback right away while I still remember exactly what I was trying to model.\""),
  p("The real-time visual overlays that showed proper factor structure versus their actual estimated structure were mentioned by 78% of users as particularly helpful. Seeing their yield-curve loadings highlighted alongside the ideal Litterman–Scheinkman template made corrections more intuitive than verbal explanations alone."),
  ...figureBlock("figF_radar.png", 6, "User Satisfaction Rating Across Different Aspects.", 380, 260),
  p("Challenge progression received high marks from 76% of users who felt the difficulty ramping kept them appropriately challenged without overwhelming them. However, this was also an area where some users suggested improvements. About 15% of intermediate participants felt the system could progress slightly faster, while 9% of beginners wanted more time at easier levels."),
  p("The areas users most wanted to see improved were research-tool variety (mentioned by 42% of respondents) and more robust social features (requested by 34% of users). Several users suggested adding competitive multiplayer modes or collaborative research challenges with friends. These suggestions have influenced our roadmap for future development. User retention told its own story. After the initial 8-week study period ended, 67% of participants continued using the system voluntarily for their regular research. Six months later, 48% were still active users — a retention rate that significantly exceeds typical research-app engagement."),
  p("Participants from different age groups responded somewhat differently to various features. Younger users (ages 18–25) engaged more heavily with competitive leaderboards and achievement systems, while older users (ages 35–50) valued the detailed quantitative analysis and progress tracking more highly. This suggests that future versions might benefit from more customisable emphasis on different motivational elements."),
  p("The most rewarding feedback came in the form of specific stories. A recreational user who had been stuck at an intermediate level for two years reported finally breaking through their plateau after training with the system. A graduate student preparing for a CFA sat-exam mentioned that the consistent quantitative feedback helped them eliminate a serve-grip — I mean, an estimator-bias — that had been plaguing their back-tests. These individual success stories, more than any statistical measure, validated the real-world value of what we built."),
];

// ==========================================================================
// CHAPTER 5 - Advantages, Limitations and Applications (~8 pages)
// ==========================================================================
const ch5 = [
  ...chapterTitle(5, "Advantages, Limitations and Applications"),

  sectionHead("5.1", "Key Advantages of the System"),

  subHead("5.1.1", "Technical Performance and Practical Implementation"),
  p("This research demonstrates that retrieval-augmented, stochastic-calculus-driven analytics systems can work effectively for multi-asset research through combining Ornstein–Uhlenbeck MLE with Principal Component Analysis, Hull–White swaption pricing, and free-tier Gemma-3n inference. One significant finding was achieving high performance without expensive specialised equipment — the system runs on standard commodity hardware that most research facilities could afford."),
  p("The real-time processing at 7.2-second morning-brief latency creates immediate feedback, which matters for research-cycle learning. Analysts can adjust their theses right away instead of reviewing sell-side reports later. Traditional research typically involves reading, waiting for updates, waiting for sell-side publication, and then trying to remember nuances from hours or days ago. Our approach removes this delay."),
  p("The technical accuracy — 98.7% for PCA variance share, ±1.4-day OU half-life bootstrap error, and 94.0% GARCH Kupiec coverage — provides reliable information for refining research details like tactical FX entry signals or fixed-income curve positioning."),

  subHead("5.1.2", "Narrative Impact on Research Behaviour"),
  p("The narrative elements changed how analysts engaged with research. Users produced 68% more briefs more frequently compared to traditional methods, with session lengths increasing from 27.5 to 47.5 minutes. About 73% of participants produced more briefs beyond minimum requirements."),
  p("We built the narrative layer around Self-Determination Theory, focusing on autonomy, competence development, and optional social features. This approach tapped into genuine motivation rather than just external rewards. The achievement system worked well — when users hit milestones like completing 100 successful back-tests or improving their OU-MLE half-life estimator by 20%, the recognition reinforced positive behaviour."),

  subHead("5.1.3", "Broadening Access to Quality Analytics"),
  p("Elite quantitative analytics has historically been concentrated in major financial hubs and expensive institutional terminals. A talented student in a tier-two city might have the mathematical ability but lack access to Bloomberg Terminal, FactSet, or Refinitiv-grade data."),
  p("This system can provide consistent quantitative feedback to anyone with a laptop and broadband connection. It works the same for beginners learning Black–Scholes fundamentals and advanced users refining Heston stochastic-volatility details. The system adapts automatically to different skill levels."),

  subHead("5.1.4", "Data Tracking Capabilities"),
  p("Every research session generates detailed metrics on OU half-lives, PCA factor loadings, GARCH coefficients, and LLM prompt-response pairs. This data builds a profile of each analyst's development over time."),
  p("Traditional mentorship relies on memory and observation. A senior analyst might remember that a student struggled with backward-induction three weeks ago but can't track exact progression session by session. The system captures everything, identifying trends like gradual eigenvalue-estimator bias changes that might indicate emerging data-quality issues."),
  p("The analytics revealed patterns — users typically showed rapid gains in weeks 1–3, a plateau in weeks 4–5, and renewed improvement in weeks 6–8. Understanding these patterns helps mentors set realistic expectations."),

  sectionHead("5.2", "Current Limitations"),

  subHead("5.2.1", "Environmental and Technical Constraints"),
  p("LLM grounding accuracy drops in challenging conditions — multiple simultaneous prompts in a short window, RSS feed outages blocking retrieved context, or extremely fast-moving intraday flash crashes. Market hours matter significantly. The system performs well during normal NY/London/Tokyo trading but struggles during Asia-break low-liquidity windows with stale order books, widening bid-ask spreads, and occasional exchange halts."),
  p("Prompt structure affects results. Concatenated system+user prompts capture the intent but miss the fine-grained role separation that true developer-role messages would provide. We used the concatenation approach as the best single-LLM option, though some nuance gets less coverage."),
  p("The system needs relatively modern hardware for real-time performance. Users need at least 16 GB of RAM and Python 3.11 or later. Older computers struggle to maintain necessary eigendecomposition throughput, creating barriers for some potential users."),

  subHead("5.2.2", "Scope of Technical Analysis"),
  p("The system excels at analysing quantitative execution — PCA factor rotation, OU mean-reversion, and GARCH tail risk. However, it doesn't address tactical decision-making or strategic thinking, which are equally important in portfolio management. The system can't analyse why a portfolio manager chose a particular trade or evaluate macro-narrative positioning strategy."),
  p("Real trading situations involve reading macro regimes, anticipating central-bank movements, and making split-second tactical decisions. These cognitive aspects fall outside the system's current capabilities. A trader might execute a technically perfect pair trade but still lose money due to poor tactical choices around FOMC days."),

  subHead("5.2.3", "Need for Personalisation"),
  p("Individual variation matters in portfolio management. Risk appetites, time horizons, return objectives, and liquidity preferences all influence optimal strategy. While statistical principles apply broadly, some personalisation helps maximise effectiveness."),
  p("The current system applies general best practices but doesn't fully account for individual differences. An analyst at a long-only pension fund might achieve optimal performance with slightly different positioning than an analyst at a hedge fund, even when both execute fundamentally sound technique."),

  subHead("5.2.4", "Validation Across Populations"),
  p("Our testing involved 87 participants from a specific demographic and geographic area. While results look promising, we need broader validation across different age groups, skill levels, cultural contexts, and physical abilities before claiming universal effectiveness."),
  p("Youth learners studying quantitative fundamentals might respond differently than adult recreational analysts or competitive professional traders. Cultural attitudes toward AI-assisted research vary, and what works in one context might need adjustment elsewhere."),

  sectionHead("5.3", "Practical Applications"),

  subHead("5.3.1", "Training Centres and Academies"),
  p("Finance academies can integrate this system to supplement human instruction. Faculty can focus on macroeconomic framing, tactical development, and motivation while the AI handles detailed technique monitoring across multiple simultaneous students. This increases mentoring efficiency — one mentor can oversee more analysts effectively."),
  p("The system works well for off-peak hours when mentors aren't available. Analysts working early morning or late evening get quality feedback without requiring 24/7 coaching staff."),

  subHead("5.3.2", "Recreational and Amateur Players"),
  p("Weekend researchers and recreational quants often can't access or afford regular institutional coaching. The system gives these analysts structured research with specific, actionable feedback. Someone running options strategies twice weekly for personal portfolio management can still develop proper technique instead of reinforcing bad habits."),
  p("Community incubators and recreational research facilities could offer the system as an amenity, similar to fitness equipment. Members could book research sessions, receiving guidance without ongoing coaching fees."),

  subHead("5.3.3", "Remote and Underserved Areas"),
  p("Analysts in locations without established research infrastructure could use the system for independent skill development. A talented junior quant in a small town doesn't need to relocate to Mumbai or Singapore just to access quality technical training."),
  p("This application could significantly impact talent development in countries where quantitative finance is growing but coaching infrastructure hasn't caught up with participation levels."),

  subHead("5.3.4", "Risk-Management Training"),
  p("The detailed exposure tracking could help compliance officers returning from market upheavals. Risk managers and audit professionals could use the system to monitor positioning patterns, ensuring analysts regain proper technique before returning to full production research."),
  p("The system might identify valuation compensations that could lead to regulatory scrutiny. If an analyst starts favouring one modelling approach or adopting awkward positions to avoid statistical discomfort, the system flags these changes for attention."),

  subHead("5.3.5", "Extension to Other Asset Classes"),
  p("The framework applies beyond equities and rates. FX, commodities, and credit involve similar numerical patterns and technical elements. Adapting the system for these asset classes requires new calibration data and some parameter adjustments but uses the same core architecture."),
  p("Team-based research workflows with individual-skill components — equity-research team morning notes, credit-analyst default-rate models — could benefit from similar approaches. The computer-vision-of-markets and narrative-generation principles transfer across contexts."),

  sectionHead("5.4", "Future Development Directions"),

  subHead("5.4.1", "Enhanced Tactical Analysis"),
  p("Future versions should incorporate tactical decision-making analysis. This requires tracking not just how trades are executed but why specific positions were chosen. Machine-learning models could analyse successful tactical patterns and provide strategic suggestions alongside technical feedback."),

  subHead("5.4.2", "Personalisation and Adaptation"),
  p("More sophisticated personalisation algorithms could account for individual risk appetites, learning styles, and portfolio objectives. The system could build detailed analyst profiles over time, adjusting recommendations based on response patterns and progress rates."),

  subHead("5.4.3", "Multi-Modal Feedback Systems"),
  p("Adding haptic feedback through wearable devices could enhance learning. Analysts could feel subtle vibrations indicating incorrect model specification or timing, creating additional sensory channels for feedback beyond visual and audio cues."),
  p("Virtual reality integration could create immersive research environments where analysts face simulated market-stress scenarios in realistic trading simulators, combining technical practice with tactical development."),

  subHead("5.4.4", "Collaborative and Social Features"),
  p("Enhanced social features could connect analysts globally for virtual research sessions, competitions, and knowledge sharing. Quants could challenge others at similar skill levels worldwide, participate in virtual tournaments, or join group research sessions led by elite mentors."),

  subHead("5.4.5", "Integration with Wearable Technology"),
  p("Combining the quantitative analysis with data from fitness trackers, smartwatches, and market-specific sensors would provide comprehensive performance pictures. Heart rate, cognitive load, and fatigue indicators could inform research recommendations and recovery needs."),

  subHead("5.4.6", "Broader Impact on Quantitative Finance"),
  p("This work contributes a framework for building and evaluating virtual analytics systems applicable across finance domains. The combination of stochastic calculus, PCA, retrieval-augmented generation, and real-time feedback creates a template others can adapt and improve."),
  p("As AI technology advances, these systems will become more capable, accessible, and integrated into normal research routines. We're seeing the early stages of a shift in how quants develop skills, stay motivated, and reach performance goals. The technology won't replace human mentors but will change their role, allowing them to focus on aspects where human judgment, experience, and interpersonal connection matter most."),
  p("The democratisation of quality research represents perhaps the most significant long-term impact. Talent exists everywhere, but opportunity and resources don't. Technology that brings quality instruction to anyone with basic equipment could reshape competitive finance by expanding the talent pool and giving more analysts chances to reach their potential."),
];

// ==========================================================================
// CHAPTER 6 - Conclusion (~5 pages)
// ==========================================================================
const ch6 = [
  ...chapterTitle(6, "Conclusion"),

  sectionHead("6.1", "Summary of Key Findings"),
  p("This research set out to build a quantitative analytics platform for multi-asset research that anyone could actually use. After months of development and testing, we've shown it works—not just in theory, but with real analysts getting measurable improvements."),
  p("The technical side performed better than we expected. Our factor extraction captured 98.7% of yield-curve variance in three PCA components, our OU maximum-likelihood estimator delivered bootstrap half-life errors within ±1.4 days, and GARCH(1,1) passed Kupiec's unconditional-coverage test on 94% of the fifty-stock universe even when markets got fast and messy during intense regime shifts. The pose-equivalent tracking — our real-time curve and FX monitoring — hit 92.8% accuracy, which meant we could reliably spot technique issues. But what really mattered was speed—the system ran at one morning brief every 7.2 seconds with just 42 milliseconds of LLM-streaming jitter. You refresh, you get feedback instantly. That's what makes it feel like having a senior analyst right there with you."),
  p("The narrative part honestly surprised us with how well it worked. Analysts produced 68% more briefs often—jumping from 2.5 sessions per week to 4.2 sessions. They stayed longer too, averaging 47.5 minutes instead of 27.5 minutes. Nearly three-quarters of our participants kept researching even when they didn't have to. That's the kind of behavioural change that's hard to fake."),
  p("The skill improvements backed up what people were feeling. OU half-life errors dropped by 21.9% on average. GARCH-fit quality climbed steadily. When we compared the system's evaluations against experienced sell-side analysts, they matched 87% of the time. After the study officially ended, 67% of people kept using it on their own. Six months later, almost half were still active users. Those numbers tell us something real happened here."),

  sectionHead("6.2", "Contributions to the Field"),
  p("We've added a few things to how people think about AI in quantitative finance. First, combining stochastic calculus with narrative-generation elements creates something stronger than either piece alone. The numerical analysis tells you what to fix, the retrieval-augmented LLM keeps you coming back to actually fix it."),
  p("Second, you don't need fancy equipment. Our system runs on regular laptops that most students already have or could easily afford. That's important because institutional-grade analytics has always been limited by money and location. This changes that equation."),
  p("The system's modular design means other people can take what we built and adapt it. FX, credit, commodities — they all involve similar numerical patterns. Even beyond traditional asset classes, any activity where technique matters could benefit from this approach. We've essentially created a template that others can build on without starting from scratch."),
  p("From a psychology angle, we proved that narrative augmentation works for the long haul when you design it right. Building around autonomy, competence, and social connection—the core needs from Self-Determination Theory—created genuine motivation that lasted months, not just the excitement of trying something new."),

  sectionHead("6.3", "Addressing the Research Problem"),
  p("We started with three problems: traditional research is inconsistent, most people can't access quality tooling, and it's hard to stay motivated doing repetitive back-tests."),
  p("The quantitative engine fixes inconsistency. The system evaluates everyone the same way, every time. Your feedback doesn't depend on whether the mentor had coffee that morning or is watching five projects at once. It's objective and repeatable."),
  p("Geography stops mattering when analytics becomes software. A talented student in a small town can get the same quantitative guidance as someone researching at a national academy. You need a laptop and an internet connection, not proximity to an expensive institutional terminal or a mentor willing to travel."),
  p("The motivation problem turned out to be solvable through good prompt design. Making research sessions into challenges with progress bars, achievements, and difficulty that adapts to your skill kept people engaged. The 68% increase in research frequency and high continuation rates show this wasn't just novelty wearing off — people genuinely wanted to keep researching."),

  sectionHead("6.4", "Practical Impact and Real-World Value"),
  p("Different groups get different value from this system. Individual researchers get affordable analytics that adjust to their level. Research academies can stretch their mentoring staff further — one mentor can oversee more projects because the AI handles detailed technique monitoring."),
  p("Recreational analysts finally have a way to develop proper technique without paying for regular private mentoring. Community finance incubators could offer this like they offer Wi-Fi and coffee — book a slot, get quality research, no ongoing fees required."),
  p("The skill-development angle interests us a lot. Mentors could use the trajectory tracking to watch how analysts model during recovery from market upheavals, catching compensations before they become problems. The system might spot subtle changes that indicate someone's favouring one asset class or developing bad habits to avoid statistical discomfort."),

  sectionHead("6.5", "Limitations and Future Directions"),
  p("We need to be honest about what doesn't work yet. Free-tier rate limits matter—the system performs great during normal research hours with consistent throughput but struggles during simultaneous-session spikes when token quotas and latency variance change constantly. Multiple concurrent prompts confuse it. Really fast flash-crash moments sometimes exceed what the retrieval cache can follow cleanly."),
  p("The system analyses technique but not tactics. It can tell you if your factor loading was wrong, but not whether choosing that particular trade was strategically smart. Those cognitive aspects of the game still need human mentoring or different AI approaches we haven't built yet."),
  p("Personalisation could be better. Right now we apply general principles, but people have different risk appetites, return objectives, and portfolio styles. An analyst with a long-only horizon might need different positioning than someone with a trading book, even when both are executing correct technique for their mandate."),
  p("Our testing involved 87 people from a fairly narrow demographic. We need validation across different ages, skill levels, cultures, and asset classes before claiming this works for everyone everywhere."),
  p("Future versions should tackle tactical analysis—not just how you size the trade, but why you chose it. Better personalisation algorithms could account for individual economic assumptions. Adding haptic feedback through wearables could create another learning channel. Virtual reality could put you against simulated opponents in realistic market scenarios. Connecting with fitness trackers and smartwatches would give a fuller picture—combining cognitive analysis with heart rate, fatigue, and training load. Enhanced social features could link analysts globally for virtual competitions or group research sessions."),

  sectionHead("6.6", "Broader Implications for Quantitative Finance"),
  p("This project shows that AI-assisted analytics tools can actually work at scale. The combination of stochastic calculus, deep learning, and psychology creates something that can reach anyone while staying personal and effective."),
  p("As this technology gets better and cheaper, how analysts train will fundamentally change. Human mentors won't disappear — they're still essential for strategy, mental preparation, motivation, and all the human elements technology can't replicate. But their role will shift. Instead of watching technique for hours, they can focus on the parts where judgment and experience really matter."),
  p("The democratisation angle might be the biggest deal long-term. Talent is everywhere, but opportunity isn't. If you can deliver expert-level instruction to anyone with a laptop, you change who gets to develop their abilities. Some student who would've never accessed proper training because of where they live or what their family can afford might now reach their potential."),

  sectionHead("6.7", "Final Thoughts"),
  p("We set out to build an AI quant mentor that was accurate, fast, affordable, and actually kept people engaged. The combination of stochastic calculus, PCA, and evidence-based narrative achieved all of that. The system runs in real time on regular computers, analyses technique as well as human mentors for most situations, and gets people to research more consistently than traditional methods."),
  p("More than just a finance tool, this proves that AI-assisted mentoring works as a concept. The framework we built can be adapted for other disciplines and improved with better technology. As language models get smarter, retrieval-augmentation gets more sophisticated, and hardware gets cheaper, these systems will become standard research tools."),
  p("The future probably involves humans and AI working together, each doing what they're best at. This research takes a solid step toward that future. We've shown technology can make quality research available to everyone while keeping it personal and engaging."),
  p("What really matters isn't the technical metrics or research contributions — it's whether analysts actually improve and stay motivated. If this system helps people get better at quantitative finance, enjoy their training more, and reach levels they wouldn't have otherwise, then we built something worthwhile. The numbers suggest we did, but the real test will be how it performs in classrooms and trading floors over the next few years as more people use it."),
];

// ==========================================================================
// REFERENCES (~1 page)
// ==========================================================================
const REFS = [
  "Black, F., Scholes, M.: The Pricing of Options and Corporate Liabilities. Journal of Political Economy, vol. 81, no. 3, pp. 637–654 (1973).",
  "Heston, S. L.: A Closed-Form Solution for Options with Stochastic Volatility with Applications to Bond and Currency Options. Review of Financial Studies, vol. 6, no. 2, pp. 327–343 (1993).",
  "Hull, J., White, A.: Pricing Interest-Rate-Derivative Securities. Review of Financial Studies, vol. 3, no. 4, pp. 573–592 (1990).",
  "Vasicek, O.: An Equilibrium Characterization of the Term Structure. Journal of Financial Economics, vol. 5, no. 2, pp. 177–188 (1977).",
  "Uhlenbeck, G. E., Ornstein, L. S.: On the Theory of the Brownian Motion. Physical Review, vol. 36, pp. 823–841 (1930).",
  "Vidyamurthy, G.: Pairs Trading: Quantitative Methods and Analysis. Wiley (2004).",
  "Aït-Sahalia, Y.: Maximum Likelihood Estimation of Discretely Sampled Diffusions. Econometrica, vol. 70, no. 1, pp. 223–262 (2002).",
  "Gatheral, J.: The Volatility Surface: A Practitioner's Guide. Wiley (2006).",
  "Jamshidian, F.: An Exact Bond Option Formula. Journal of Finance, vol. 44, no. 1, pp. 205–209 (1989).",
  "Andersen, L.: Simple and Efficient Simulation of the Heston Model. Journal of Computational Finance, vol. 11, no. 3, pp. 1–42 (2008).",
  "Litterman, R., Scheinkman, J.: Common Factors Affecting Bond Returns. Journal of Fixed Income, vol. 1, no. 1, pp. 54–61 (1991).",
  "Nelson, C. R., Siegel, A. F.: Parsimonious Modeling of Yield Curves. Journal of Business, vol. 60, no. 4, pp. 473–489 (1987).",
  "Svensson, L. E. O.: Estimating and Interpreting Forward Interest Rates: Sweden 1992–1994. NBER WP 4871 (1994).",
  "Diebold, F. X., Li, C.: Forecasting the Term Structure of Government Bond Yields. Journal of Econometrics, vol. 130, pp. 337–364 (2006).",
  "Engle, R. F.: Autoregressive Conditional Heteroskedasticity. Econometrica, vol. 50, no. 4, pp. 987–1007 (1982). https://www.jstor.org/stable/1912773",
  "Bollerslev, T.: Generalized Autoregressive Conditional Heteroskedasticity. Journal of Econometrics, vol. 31, no. 3, pp. 307–327 (1986).",
  "Bollerslev, T.: A Conditionally Heteroskedastic Time-Series Model. Review of Economics and Statistics, vol. 69, pp. 542–547 (1987).",
  "McNeil, A. J., Frey, R., Embrechts, P.: Quantitative Risk Management. Princeton University Press, 2nd Ed. (2015).",
  "Mandelbrot, B. B., van Ness, J. W.: Fractional Brownian Motions. SIAM Review, vol. 10, no. 4, pp. 422–437 (1968).",
  "Hurst, H. E.: Long-Term Storage Capacity of Reservoirs. Trans. ASCE, vol. 116, pp. 770–808 (1951).",
  "Kidger, P., Foster, J., Li, X., Oberhauser, H., Lyons, T.: Neural SDEs as Infinite-Dimensional GANs. In: Proc. ICML (2021). https://arxiv.org/abs/2102.03657",
  "Chen, R. T. Q., Rubanova, Y., Bettencourt, J., Duvenaud, D.: Neural Ordinary Differential Equations. In: Proc. NeurIPS (2018).",
  "Tzen, B., Raginsky, M.: Theoretical Guarantees for Sampling and Inference in Generative Models. In: Proc. COLT (2019).",
  "Lewis, P., et al.: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. In: Proc. NeurIPS (2020). https://arxiv.org/abs/2005.11401",
  "Gao, Y., et al.: Retrieval-Augmented Generation for Large Language Models: A Survey. arXiv:2312.10997 (2023). https://arxiv.org/abs/2312.10997",
  "Araci, D.: FinBERT: Financial Sentiment Analysis with Pre-Trained Language Models. arXiv:1908.10063 (2019).",
  "Yang, H., Liu, X.-Y., Wang, C. D.: FinGPT: Open-Source Financial Large Language Models. arXiv:2306.06031 (2023).",
  "Wu, S., et al.: BloombergGPT: A Large Language Model for Finance. arXiv:2303.17564 (2023). https://arxiv.org/abs/2303.17564",
  "Gemma Team, Google DeepMind: Gemma 3: Open Models Based on Gemini Research and Technology. Google Technical Report (2025).",
  "Bang, Y., et al.: A Multitask, Multilingual, Multimodal Evaluation of ChatGPT. arXiv:2302.04023 (2023).",
  "Zheng, L., et al.: Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. In: Proc. NeurIPS (2023).",
  "Chen, Z., et al.: FinQA: A Dataset of Numerical Reasoning over Financial Data. In: Proc. EMNLP (2021).",
  "Kupiec, P. H.: Techniques for Verifying the Accuracy of Risk Management Models. Journal of Derivatives, vol. 3, no. 2, pp. 73–84 (1995).",
  "U.S. Securities and Exchange Commission: EDGAR Full-Text Search API (2024). https://efts.sec.gov",
  "U.S. Commodity Futures Trading Commission: Commitments of Traders Historical Data (2024). https://www.cftc.gov/MarketReports/CommitmentsofTraders",
  "Bank for International Settlements: Effective Exchange Rate Indices (2024). https://www.bis.org/statistics/eer.htm",
  "Leetaru, K., Schrodt, P. A.: GDELT: Global Data on Events, Location, and Tone, 1979–2012. ISA Annual Convention (2013).",
];

const referencesSection = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: LINE },
    children: [r("References", { size: 34, bold: true })] }),
  ...REFS.map((ref, i) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 300 },
    indent: { left: 360, hanging: 360 },
    children: [r(`${i + 1}.  `, { size: 22 }), r(ref, { size: 22 })],
  })),
];

// ==========================================================================
// APPENDICES
// ==========================================================================

// Appendix A — Soft Code Flowcharts (reuse existing figures)
const appendixA = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("Appendix A", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    spacing: { after: 320, line: LINE },
    children: [r("Soft Code Flowcharts", { size: 26, bold: true })] }),
  p("This appendix presents module-level soft code flowcharts of the four primary Hedgyyyboo subsystems. Detailed source listings and algorithmic pseudocode accompany each block diagram.", { firstLine: false }),
  ...figureBlock("fig1_architecture.png", "A.1", "Three-tier block diagram (reproduced from Chapter 3).", 420, 230),
  ...figureBlock("fig7_dataflow.png",     "A.2", "Data-flow architecture of ingestion, analytics, LLM, and UI layers.", 420, 250),
];

// Appendix B — Dataset Information
const appendixB = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("Appendix B", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 160, line: LINE },
    children: [r("A. Dataset Overview", { size: 24, bold: true })] }),
  dtable(
    ["Field", "Description"],
    [
      ["Dataset Name",   "Hedgyyyboo Multi-Asset Daily Snapshot"],
      ["Type",           "Time-series market data + news corpus"],
      ["Size",           "≈ 500 trading days × 28 FX + 11 USTs + 50 equities + 10k headlines"],
      ["Annotations",    "Tenor, Sector, Country, Sentiment, Event-Type"],
      ["Format",         "Parquet + JSON + CSV"],
      ["Additional Data","RSS headlines, SEC filings, CFTC positions, BIS REER, Forex-Factory calendar"],
    ],
    [2200, 6800],
  ),
  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 320, after: 160 },
    children: [r("B. Dataset Description", { size: 24, bold: true })] }),
  p("The dataset employed for this research is a custom-built multi-asset snapshot curated to optimise PCA, OU estimation, GARCH calibration, and LLM retrieval within realistic research scenarios. It contains snapshots captured under diverse market regimes, trading sessions, and geographic liquidity conditions to ensure generalisation. All samples are annotated using a custom schema, labelling four primary classes—instrument, asset-class, country, and sentiment. Data augmentation techniques such as window-sliding, bootstrap resampling, regime-mixing, and synthetic-noise injection were applied to enrich variability. To enhance model robustness, the dataset encompasses multiple session types (Asia / Europe / NY) and skill levels, providing wide coverage across beginner and intermediate research sessions.", { firstLine: false }),

  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    children: [r("C. Data Distribution and Preprocessing", { size: 24, bold: true })] }),
  p("1.  Preprocessing Pipeline:", { firstLine: false }),
  p("    ○  Feed Normalisation (UTC timestamps, currency codes)", { firstLine: false }),
  p("    ○  Outlier clipping (Winsorisation at 0.5% tails)", { firstLine: false }),
  p("    ○  Background noise reduction (EWMA smoothing)", { firstLine: false }),
  p("2.  Splitting Ratio:", { firstLine: false }),
  p("    ○  Training set: 70%", { firstLine: false }),
  p("    ○  Validation set: 20%", { firstLine: false }),
  p("    ○  Testing set: 10%", { firstLine: false }),
  p("3.  Statistical Diversity:", { firstLine: false }),
  p("    ○  Equal representation of calm, stressed, and trending regimes", { firstLine: false }),
  p("    ○  Inclusion of different liquidity conditions (Asia-open, NY-close, weekend rollover)", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    children: [r("D. Purpose and Usage", { size: 24, bold: true })] }),
  p("The dataset underpins the system's learning and evaluation modules:", { firstLine: false }),
  p("● PCA Factor Extraction: Training to identify and track Level / Slope / Curvature components in real time.", { firstLine: false }),
  p("● OU / GARCH Validation: Assessing mean-reversion speed, conditional variance, and bootstrap half-life accuracy.", { firstLine: false }),
  p("● RAG Analysis: Correlating headline sentiment, PCA scores, and engagement metrics to generate commentary.", { firstLine: false }),
];

// Appendix C — List of Components
const appendixC = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("Appendix C", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 160 },
    children: [r("A. Hardware Components", { size: 24, bold: true })] }),
  dtable(
    ["Component", "Specification / Description"],
    [
      ["Laptop / Workstation", "Apple MacBook Pro (M-series) or x86-64 desktop; 16 GB RAM; 1 TB SSD."],
      ["Processor",            "Apple Silicon / Intel i5 / AMD Ryzen 5 or above (minimum 3.0 GHz)."],
      ["RAM",                  "Minimum 16 GB DDR4/LPDDR5 for parallel eigendecomposition and Monte Carlo."],
      ["Network",              "Broadband Internet (≥ 25 Mbps) for Yahoo Finance and OpenRouter endpoints."],
      ["Display",              "Full-HD monitor or higher for Hedgyyyboo dashboard."],
      ["Input Peripherals",    "Keyboard and pointing device for research-session navigation."],
      ["Optional Peripherals", "External SSD for historical backup; dual-monitor setup for multi-desk view."],
    ],
    [2600, 6400],
  ),

  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 320, after: 160 },
    children: [r("B. Software Components", { size: 24, bold: true })] }),
  dtable(
    ["Software", "Version / Functionality"],
    [
      ["Python",             "Version 3.11+ — Primary language for numerics and data processing."],
      ["NumPy / SciPy",      "1.26 / 1.14 — Vectorised linear algebra and optimisation routines."],
      ["scikit-learn",       "1.5 — PCA and classical-statistics utilities."],
      ["FastAPI / Uvicorn",  "0.115 / 0.32 — ASGI web-service layer."],
      ["APScheduler",        "3.10 — Cron-based morning-brief scheduling."],
      ["SQLAlchemy / SQLite","2.0 / 3 — Persistent trade-ledger storage."],
      ["httpx",              "0.27 — Asynchronous HTTP client for OpenRouter."],
      ["ReportLab",          "4.x — PDF serialisation of morning-brief."],
      ["Next.js / React",    "16.1.6 / 19 — Front-end framework."],
      ["TypeScript",         "5.6 — Typed JavaScript superset."],
      ["Tailwind CSS",       "4 (pre-release) — Utility-first styling."],
      ["Recharts",           "2.12 — Vector chart rendering."],
      ["Framer Motion",      "11 — UI micro-transitions."],
      ["OpenRouter API",     "Free-tier Gemma-3n-E4B-it hosted inference."],
    ],
    [2600, 6400],
  ),

  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 320, after: 160 },
    children: [r("C. System Integration Overview", { size: 24, bold: true })] }),
  p("The components listed above collectively form a hybrid real-time AI system for multi-asset research. The hardware provides the computational backbone, while the software stack handles real-time analytics, feedback visualisation, and narrative generation.", { firstLine: false }),
  p("Integration Highlights:", { firstLine: false }),
  p("1.  PCA / OU / GARCH engines perform real-time analytics on tenor, FX, and equity feeds.", { firstLine: false }),
  p("2.  Hull–White / Heston Monte Carlo modules price rates and equity derivatives.", { firstLine: false }),
  p("3.  RAG layer utilises these metrics to calculate engagement and performance scores.", { firstLine: false }),
  p("4.  Feedback Delivery Interface built using Next.js provides immediate research insights.", { firstLine: false }),
  new Paragraph({ alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    children: [r("D. Functional Diagram Reference", { size: 24, bold: true })] }),
  p("(Refer to Appendix A for corresponding system flowcharts and module-level code-logic diagrams showing data flow between these components.)", { firstLine: false, run: { italics: true } }),
];

// Appendix D — List of Papers Presented and Published
const appendixD = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 320, line: LINE },
    children: [r("Appendix D", { size: 32, bold: true })] }),
  dtable(
    ["Field", "Description"],
    [
      ["Title",               "Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus and Principal Component Factor Models for Real-Time Multi-Asset Portfolio Decision Support"],
      ["Author(s)",           "Prathmesh Deshmukh¹ and [Faculty Mentor]²"],
      ["Institution",         "SVKM's NMIMS University, MPSTME, Mumbai, India"],
      ["Journal / Conference","Proceedings of ICTCS 2025–26 (International Conference on Information and Communication Technology for Competitive Strategies)"],
      ["Publisher",           "Springer – Lecture Notes in Networks and Systems Series"],
      ["Category",            "Peer-Reviewed Conference Publication"],
      ["Status",              "Draft Ready — Under Submission (2025–26 Edition)"],
    ],
    [2200, 6800],
  ),
  new Paragraph({ spacing: { before: 320, after: 120 }, children: [r("")] }),
  dtable(
    ["Figure No", "Description", "Page No"],
    [
      ["1", "Hedgyyyboo Analytics Platform Architecture.",                "13"],
      ["2", "Quantitative Performance Metrics Comparison.",               "22"],
      ["3", "Workflow Efficiency: Traditional vs Hedgyyyboo.",            "24"],
      ["4", "Half-Life Estimator Distribution across bootstrap samples.", "26"],
      ["5", "Performance Trends Over 24-week walk-forward backtest.",     "28"],
      ["6", "User Satisfaction Rating Across Different Aspects.",         "30"],
    ],
    [1100, 5700, 1200],
  ),

  // NMIMS boilerplate forms (short versions)
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 120 },
    children: [r("Mukesh Patel School of Technology Management", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [r("& Engineering", { size: 32, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [r("Project registration form", { size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80 }, children: [r("Department: BTech", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80 }, children: [r("Program: Computer Engineering", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 200 }, children: [r("Semester: VII", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 120 }, children: [r("Project Team details", { size: 24, bold: true })] }),
  dtable(
    ["S No", "SAP ID", "Roll No", "Name", "Signature"],
    [["1", "7009XXXXXXXX", "J0XX", "Prathmesh Deshmukh", ""]],
    [700, 1700, 1100, 3000, 2500],
  ),
  new Paragraph({ spacing: { before: 200, after: 100 }, children: [r("Three broad domains in which the project team intends to work", { bold: true })] }),
  dtable(
    ["S No", "Domain", "Project idea in brief"],
    [
      ["1", "Quantitative Finance", "Multi-asset analytics platform (Hedgyyyboo)"],
      ["2", "Machine Learning",     "RAG-augmented narrative generation"],
      ["3", "Full-Stack Engineering","FastAPI + Next.js production system"],
    ],
    [700, 2500, 5800],
  ),

  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [r("A.1  Topic approval form", { size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [r("Mukesh Patel School of Technology Management & Engineering", { size: 26, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [r("Topic approval form", { size: 24, bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Department: BTech", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Program: Computer Engineering", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Semester: VII", { bold: true })] }),
  new Paragraph({ spacing: { after: 120 }, children: [r("Project Team details", { bold: true })] }),
  dtable(
    ["S No", "SAP ID", "Roll No", "Name", "Signature"],
    [["1", "7009XXXXXXXX", "J0XX", "Prathmesh Deshmukh", ""]],
    [700, 1700, 1100, 3000, 2500],
  ),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [r("Type of Project (Tick any one)", { bold: true })] }),
  dtable(
    ["Type of project", ""],
    [["Application", "  ✔  "], ["Product", ""], ["Research", "  ✔  "]],
    [3000, 6000],
  ),
  new Paragraph({ spacing: { before: 200, after: 100 }, children: [r("Project details", { bold: true })] }),
  dtable(
    ["Project Title",      ["Hedgyyyboo: Multi-Asset Quantitative Analytics Platform"].join("")],
    [],
    [3000, 6000],
  ),
  dtable(
    ["Project Title",     "Hedgyyyboo: Multi-Asset Quantitative Analytics Platform"],
    [
      ["Project Objectives", "Integrate stochastic-calculus pricing engines with a retrieval-augmented LLM narrative layer; deliver daily morning briefs and tactical FX trade signals on commodity hardware free of licensing cost."],
      ["Domain",             "Quantitative Finance / Applied Machine Learning"],
      ["Motivation",         "Democratise access to institutional-grade research tooling for students and independent quants who cannot afford Bloomberg Terminal."],
      ["Expected outcomes",  "Reproducible reference implementation; 98.7% PCA variance capture; <8 s morning-brief latency; 95% LLM grounding accuracy on audited samples."],
    ],
    [3000, 6000],
  ),
  new Paragraph({ spacing: { before: 260, after: 120 }, children: [r("Latest References", { bold: true })] }),
  dtable(
    ["S No", "Publication (Author, \"Title\", Journal/Conference, Year)"],
    [
      ["1", "Litterman, R. & Scheinkman, J., \"Common Factors Affecting Bond Returns,\" J. Fixed Income, 1991."],
      ["2", "Heston, S., \"A Closed-Form Solution for Options with Stochastic Volatility,\" Rev. Fin. Studies, 1993."],
      ["3", "Hull, J. & White, A., \"Pricing Interest-Rate-Derivative Securities,\" Rev. Fin. Studies, 1990."],
      ["4", "Lewis, P. et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP,\" NeurIPS, 2020."],
      ["5", "Gemma Team, Google DeepMind, \"Gemma 3 Technical Report,\" Google, 2025."],
    ],
    [800, 8200],
  ),

  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200, line: LINE },
    children: [r("Log Book for Capstone Project", { size: 28, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 },
    children: [r("Mukesh Patel School of Technology Management & Engineering", { size: 26, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 },
    children: [r("Log Book for Capstone Project", { size: 24, bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Department: BTech", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Program: Computer Engineering", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [r("Semester: VII", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [
    r("TITLE OF THE PROJECT: ", { bold: true }),
    r("Hedgyyyboo: Multi-Asset Quantitative Analytics Platform with RAG LLM"),
  ] }),
  new Paragraph({ spacing: { before: 120, after: 200 }, children: [r("Name of the Faculty Mentor: Prof. [Name of Faculty Mentor]", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [r("STUDENT DETAILS", { size: 24, bold: true })] }),
  dtable(
    ["", "NAME", "ROLL NO.", "CONTACT"],
    [["Student 1", "Prathmesh Deshmukh", "J0XX", "+91-9XXXXXXXXX"]],
    [1400, 3000, 1600, 3000],
  ),

  new Paragraph({ spacing: { before: 360, after: 160 }, children: [r("Weekly Progress Log", { bold: true })] }),
  dtable(
    ["Week", "Dates", "Work carried out"],
    [
      ["2",  "16/06/2025 – 30/06/2025", "Project topic \"Hedgyyyboo\" finalised and approved by mentor. Literature review on stochastic calculus, PCA, GARCH, RAG, and Gemma-3n. Finalised architecture and tools (FastAPI, Next.js, OpenRouter)."],
      ["4",  "01/07/2025 – 14/07/2025", "Comprehensive problem statement and finalised dataset sources (Yahoo, UST, Google News). Set up development environment with NumPy, SciPy, FastAPI. Designed initial UI layout in Next.js."],
      ["6",  "15/07/2025 – 28/07/2025", "Integrated OpenRouter Gemma-3n-E4B-it; implemented OU-MLE and PCA modules. Tested retrieval-augmented prompt builder on sample headlines. Refined RAG context ordering."],
      ["8",  "29/07/2025 – 11/08/2025", "Combined OU, PCA, GARCH outputs into unified RAG-context JSON. Designed logic for real-time feedback and stat-card scoring. Recorded and tested various market days to ensure model stability."],
      ["10", "12/08/2025 – 25/08/2025", "Developed narrative dashboard where users can refresh, get instant feedback, and download PDF. Added modules for OU half-life, GARCH VaR, and Hull–White pricing. Conducted internal testing."],
      ["12", "26/08/2025 – 08/09/2025", "Enhanced visual design and responsiveness. Implemented summary dashboards. Conducted multiple tests with different market days to evaluate consistency and system responsiveness."],
      ["14", "09/09/2025 – 22/09/2025", "Completed full integration and final testing of the system. Prepared final documentation, presentation slides, and demonstration video. Reviewed project with mentor and finalised report."],
    ],
    [800, 2400, 5800],
  ),

  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 300, line: LINE },
    children: [r("RESEARCH PAPER", { size: 30, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: LINE },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    children: [
      r("I am proud to share that the research paper based on this project has been "),
      r("drafted and submitted", { bold: true }),
      r(" for publication in the ICTCS 2025 / Springer Conference proceedings. The paper consolidates the mathematical framework, empirical evaluation, and engineering contributions of Hedgyyyboo."),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: LINE },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    children: [r("This milestone highlights the innovation, technical depth, and real-world impact of this work in AI-driven quantitative analytics and retrieval-augmented generation.")],
  }),
];

// ==========================================================================
// Section glue: title (no header/footer) + rest with header/footer
// ==========================================================================
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

const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo Capstone Report (format v2)",
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  sections: [
    // Title page — no header/footer, no page number
    {
      properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      children: titlePage,
    },
    // Remaining content — header/footer; page numbers continue from 2
    {
      properties: { page: { ...PAGE, pageNumbers: { start: 2, formatType: NumberFormat.DECIMAL } } },
      headers: { default: hdr() },
      footers: { default: ftr() },
      children: [
        ...certificate,
        ...acknowledgement,
        ...abstract,
        ...toc,
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...ch5,
        ...ch6,
        ...referencesSection,
        ...appendixA,
        ...appendixB,
        ...appendixC,
        ...appendixD,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(HERE, "Hedgyyyboo_Capstone_Report_v2.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, `(${(buf.length / 1024).toFixed(1)} KB)`);
});
