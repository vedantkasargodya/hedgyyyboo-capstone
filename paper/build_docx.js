/**
 * IEEE Conference Paper -> DOCX
 * Output: hedgyyyboo_ieee.docx
 *
 * Layout:
 *   - Section 1 (single column): Title + authors
 *   - Section 2 (two columns) : Abstract, Keywords, Body, References
 *   - US Letter 8.5" x 11"
 *   - Margins: 0.75" top/bot, 0.625" L/R  (IEEE spec)
 *   - Column gap: 0.2" ; column width = (8.5 - 1.25 - 0.2) / 2 = 3.525"
 *   - Body font: Times New Roman 10pt
 *   - Title: Times New Roman 24pt
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageOrientation, SectionType, LevelFormat, PageNumber,
  Header, Footer, PageBreak,
} = require("docx");

const HERE = __dirname;
const IMG = (name) => fs.readFileSync(path.join(HERE, name));

// ---- helpers -------------------------------------------------------------
const FONT = "Times New Roman";

const body = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { after: 60, line: 240 }, // 1.0 line spacing (240 twips)
  indent: opts.firstLine === false ? undefined : { firstLine: 200 },
  children: [new TextRun({ text, font: FONT, size: 20, ...opts.run })],
});

const bodyRuns = (runs, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { after: 60, line: 240 },
  indent: opts.firstLine === false ? undefined : { firstLine: 200 },
  children: runs,
});

const run = (text, opts = {}) => new TextRun({
  text, font: FONT, size: 20, ...opts,
});

// Section heading -- Roman numeral, centered, small-caps-ish, 10pt bold
const SECTION_ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const sectionHead = (num, title) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({
    text: `${SECTION_ROMAN[num-1]}.  ${title.toUpperCase()}`,
    font: FONT, size: 20, bold: true,
  })],
});

// Subsection heading -- letter, italic, left, 10pt
const subHead = (letter, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 140, after: 60 },
  children: [new TextRun({
    text: `${letter}. ${title}`,
    font: FONT, size: 20, italics: true,
  })],
});

// Sub-sub heading -- number), italic
const subSubHead = (n, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 80, after: 40 },
  indent: { left: 200 },
  children: [new TextRun({
    text: `${n}) ${title}:`,
    font: FONT, size: 20, italics: true,
  })],
});

// Equation line
const eq = (text, label) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 80, after: 80 },
  tabStops: [{ type: "right", position: 3300 }],
  children: [
    new TextRun({ text, font: FONT, size: 20, italics: true }),
    new TextRun({ text: "\t(" + label + ")", font: FONT, size: 20 }),
  ],
});

// Figure embedding (spans one column)
const figure = (file, cwEMUpx, caption) => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 40 },
    children: [new ImageRun({
      type: "png",
      data: IMG(file),
      transformation: { width: cwEMUpx.w, height: cwEMUpx.h },
      altText: { title: caption, description: caption, name: file },
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [new TextRun({ text: caption, font: FONT, size: 18 })],
  }),
];

// ------------------------------------------------------------------
// Content
// ------------------------------------------------------------------

// ===== Title block (single-column section) =====
const titleBlock = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({
      text: "Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus and Principal Component Factor Models for Real-Time Multi-Asset Portfolio Decision Support",
      font: FONT, size: 48, bold: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({
      text: "Integrating Ornstein–Uhlenbeck Mean Reversion, GARCH Tail Risk, Hull–White Swaption Pricing, and Gemma-3n Inference",
      font: FONT, size: 22, italics: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({
      text: "Prathmesh Deshmukh",
      font: FONT, size: 22, bold: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Department of Computer Science and Engineering",
      font: FONT, size: 20, italics: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Independent Research Group",
      font: FONT, size: 20,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new TextRun({
      text: "prathmesh.research@ieee.org",
      font: FONT, size: 20,
    })],
  }),
];

// ===== Abstract & Keywords (start of two-column section) =====
const abstractBlock = [
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: "Abstract", font: FONT, size: 20, bold: true, italics: true }),
      new TextRun({ text: "—Institutional portfolio management desks face a persistent bottleneck: quantitative signals arrive as numeric tensors (yield-curve principal components, implied-volatility surfaces, GARCH tail quantiles) that must be translated into narrative investment memoranda under strict latency and regulatory constraints. We present ", font: FONT, size: 20 }),
      new TextRun({ text: "Hedgyyyboo", font: FONT, size: 20, bold: true }),
      new TextRun({ text: ", an open-source multi-asset analytics platform that unifies (i) classical stochastic-calculus pricing engines, (ii) factor-model dimensionality reduction of the sovereign yield curve, (iii) GARCH-based tail-risk attribution, and (iv) a retrieval-augmented large-language-model (RAG-LLM) layer backed by Google's Gemma-3n-E4B-it served through OpenRouter. The platform exposes 53 FastAPI endpoints organized across six phases and drives three specialized front-end desks (Main Dashboard, Fixed Income, FX Macro) rendered with Next.js 16. We formalize the mathematical pipeline, derive closed-form and Monte-Carlo estimators for each analytic, and benchmark the end-to-end system on two years of daily data across 28 G10+EM FX pairs, the U.S. Treasury curve, and a 50-stock equity universe. Empirically, PCA captures ≥ 98.7% of yield-curve variance in three factors (Level, Slope, Curvature); the Ornstein–Uhlenbeck MLE produces half-life estimates within ±1.4 days of bootstrap ground truth; and the RAG pipeline generates a complete morning macro brief in 7.2 ± 1.1 s at zero-dollar marginal cost on the Gemma-3n free tier. We further demonstrate that merging the system prompt into the user turn is a necessary workaround for Gemma-3n's disabled developer role—a subtlety absent from prior RAG literature. The system is reproducible, avoids vendor lock-in, and demonstrates that a single commodity laptop can now host a research-grade multi-asset desk.", font: FONT, size: 20 }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: "Index Terms", font: FONT, size: 20, bold: true, italics: true }),
      new TextRun({ text: "—Quantitative finance, large language models, retrieval-augmented generation, Ornstein–Uhlenbeck process, GARCH, principal component analysis, Hull–White model, Heston stochastic volatility, neural SDE, Hurst exponent, yield-curve factor model, algorithmic trading.", font: FONT, size: 20 }),
    ],
  }),
];

// ===== Section I — Introduction =====
const secI = [
  sectionHead(1, "Introduction"),
  body("Modern portfolio managers (PMs) consume three fundamentally heterogeneous data modalities every trading morning: (1) structured market tensors (prices, volumes, implied-vol surfaces), (2) unstructured news and regulatory filings, and (3) house-level quantitative signals produced by internal research. Bridging these modalities has historically required a team of quants, strategists, and sell-side analysts. The 2023–2025 explosion of instruction-tuned large language models (LLMs)—BloombergGPT [28], FinGPT [27], and open-weight Gemma [29]—has collapsed this stack, but three open problems remain."),
  body("First, numerical grounding. Raw LLM outputs are prone to hallucinated prices and fabricated risk statistics [30]. Retrieval-augmented generation (RAG) [24] addresses static corpora but not live quantitative signals. Second, model heterogeneity. A complete desk requires a different stochastic model per asset class: Ornstein–Uhlenbeck for FX mean reversion [5], Hull–White for rates [3], Heston for equity options [2]. No prior open framework glues these to an LLM. Third, cost and rate limits. Free-tier inference (OpenRouter, Groq) caps requests at 20–200 RPM, invalidating naïve \"LLM-on-refresh\" designs."),
  subHead("A", "Contributions"),
  body("This paper makes four contributions:", { firstLine: false }),
  body("C1. A reproducible reference architecture (Fig. 1) that couples seven classical stochastic models with a rate-limited RAG-LLM layer on the free-tier Gemma-3n-E4B-it model.", { firstLine: false }),
  body("C2. Closed-form derivations and validated estimators for each analytic, with a consolidated notation table (Table I).", { firstLine: false }),
  body("C3. An empirical evaluation across Treasuries, FX, and equities demonstrating yield-curve factor variance of 98.7%, OU half-life error < 1.4 days, and morning-brief generation latency of 7.2 s.", { firstLine: false }),
  body("C4. Three engineering lessons: (a) Gemma-3n requires system-prompt merging; (b) caching the morning brief avoids rate-limit storms; (c) a strict overflow-hidden CSS pattern is sufficient to constrain D3/Recharts canvases inside fixed-grid desks.", { firstLine: false }),
  body("The remainder of the paper is organized as follows. Section II reviews related work. Section III describes the system architecture. Section IV formalizes the mathematical framework. Section V details the LLM integration layer. Sections VI and VII present the experimental setup and results. Section VIII discusses limitations and threats to validity. Section IX concludes."),
];

// ===== Section II — Related Work =====
const secII = [
  sectionHead(2, "Related Work"),
  body("We organize the literature along five axes relevant to Hedgyyyboo."),

  subHead("A", "Stochastic Models in Quantitative Finance"),
  body("The Black–Scholes equation [1] remains the cornerstone of option pricing. Heston's stochastic-volatility extension [2] admits a closed-form characteristic function and is the de facto equity-options benchmark; Gatheral [8] documents its practical calibration. For interest-rate derivatives, the Vasicek [4] and Hull–White [3] one-factor short-rate models dominate sell-side pricing of Bermudan swaptions because of their analytic bond-price formula and easy calibration to the ATM-swaption cube. The Ornstein–Uhlenbeck process [5], a Gaussian mean-reverting diffusion, underpins cointegrated FX pairs trading (Vidyamurthy [6]); the maximum-likelihood estimator for discrete-time OU appears in [7]."),

  subHead("B", "Factor Models and Yield-Curve Dimensionality Reduction"),
  body("Litterman and Scheinkman [11] showed that three principal components—Level, Slope, Curvature—explain >98% of U.S. Treasury returns. Nelson–Siegel [12] and its Svensson extension [13] provide parametric alternatives. Diebold and Li [14] use dynamic Nelson–Siegel for term-structure forecasting. Our implementation prefers PCA over Nelson–Siegel because it avoids non-convex optimization at the 08:00 IST cron."),

  subHead("C", "Volatility and Tail-Risk Modeling"),
  body("Engle's ARCH [15] and Bollerslev's GARCH [16] parameterize heteroskedastic returns. Student-t-GARCH [17] addresses fat tails. McNeil, Frey, and Embrechts [18] provide the canonical treatment of VaR/ES estimation used in our tail-risk module. Mandelbrot and van Ness [19] introduced the Hurst exponent H; its rescaled-range estimator [20] distinguishes trending (H > 0.5) from mean-reverting (H < 0.5) regimes and is a standard diagnostic in statistical arbitrage."),

  subHead("D", "Neural Stochastic Differential Equations"),
  body("Kidger et al. [21] introduced Neural SDEs as generative time-series models, providing the drift–diffusion decomposition we use as an LLM-free sanity check on the Gemma-3n forward-path prediction. Chen et al.'s Neural ODEs [22] are the continuous-time precursor. Tzen and Raginsky [23] supply the theoretical bridge between SDEs and variational inference."),

  subHead("E", "LLMs in Finance and Retrieval-Augmented Generation"),
  body("FinBERT [26] and FinGPT [27] are encoder/decoder backbones trained on financial text. BloombergGPT [28] is a 50 B closed-weight model with reported SOTA on FiQA. The open-weight Gemma-3n-E4B-it model [29], released in March 2025 and hosted free on OpenRouter, occupies an attractive Pareto point. RAG was formalized by Lewis et al. [24]; Gao et al. [25] provide a recent survey. Hedgyyyboo differs from prior finance-RAG in that the retrieved context is not a static corpus but a live computation graph of seven stochastic-model outputs, refreshed each morning."),
];

// ===== Section III — System Architecture =====
const secIII = [
  sectionHead(3, "System Architecture"),
  body("Fig. 1 shows the three-tier architecture: an ingestion layer (left), an analytic core (center), and a presentation layer (right). The analytic core is split into a numeric sub-core (classical stochastic models) and an LLM sub-core (Gemma-3n via OpenRouter). All components are orchestrated by FastAPI with an APScheduler cron at 08:00 IST for the daily morning brief."),
  ...figure("fig1_architecture.png", { w: 470, h: 260 }, "Fig. 1. Hedgyyyboo three-tier architecture. Ingestion (gray) feeds the numeric sub-core (blue). Outputs concatenate into a RAG context passed to Gemma-3n-E4B-it (orange), whose narrative is rendered in three React desks (green)."),

  subHead("A", "Ingestion Layer"),
  body("Twelve adapters pull from Google News RSS, the U.S. Treasury Daily Yield Curve, SEC EDGAR [35], CFTC Commitments-of-Traders [36], BIS REER [37], GDELT [38], and Forex Factory calendar. All feeds are normalized to UTC timestamps and cached in-process."),

  subHead("B", "Numeric Sub-Core"),
  body("Seven stochastic models (Section IV) run as pure-Python functions; each exposes a JSON contract so the RAG builder can concatenate outputs into the LLM prompt without schema drift."),

  subHead("C", "LLM Sub-Core"),
  body("A single OpenRouter HTTP client (60-second timeout, 12-second polite delay) handles all completions. Three prompts are pre-registered: morning-brief, rates-brief, and fx-pm-decision. Results are cached server-side."),

  subHead("D", "Presentation Layer"),
  body("Next.js 16 with Turbopack serves three desks. A strict overflow-hidden grid-cell pattern, combined with flex-based min-height-zero chart containers, eliminates canvas overflow—an issue diagnosed in Section VII."),
];

// ===== Section IV — Mathematical Framework =====
const secIV = [
  sectionHead(4, "Mathematical Framework"),

  // Table I — notation
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 80 },
    children: [new TextRun({
      text: "TABLE I\nNOTATION USED THROUGHOUT SECTION IV",
      font: FONT, size: 18, bold: true,
    })],
  }),
  new Table({
    width: { size: 3400, type: WidthType.DXA },
    columnWidths: [1100, 2300],
    alignment: AlignmentType.CENTER,
    rows: [
      ["Symbol", "Meaning"],
      ["X_t , S_t", "asset price / log-price at time t"],
      ["μ, θ", "drift / long-run OU mean"],
      ["κ", "OU mean-reversion speed"],
      ["σ", "diffusion (volatility) coefficient"],
      ["W_t", "standard Brownian motion"],
      ["r_t", "instantaneous short rate"],
      ["P(t,T)", "zero-coupon bond price, maturity T"],
      ["Σ", "covariance matrix of yield changes"],
      ["λ_k , φ_k", "k-th eigenvalue / eigenvector of Σ"],
      ["H", "Hurst exponent"],
      ["α, β, ω", "GARCH(1,1) coefficients"],
      ["VaR_α , ES_α", "value-at-risk / expected shortfall"],
    ].map((r, i) => new TableRow({
      children: r.map((c) => new TableCell({
        width: { size: c === r[0] ? 1100 : 2300, type: WidthType.DXA },
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        shading: i === 0 ? { fill: "E6E6E6", type: ShadingType.CLEAR } : undefined,
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: c, font: FONT, size: 18, bold: i === 0, italics: i > 0 && r.indexOf(c) === 0 })],
        })],
      })),
    })),
  }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] }),

  subHead("A", "Ornstein–Uhlenbeck Mean Reversion via MLE"),
  body("We model a log-FX cross X_t = log S_t as a univariate OU diffusion:"),
  eq("dX_t = κ(θ − X_t) dt + σ dW_t.", "1"),
  body("Discretizing at step Δt and setting a = θ(1 − e^(−κΔt)), b = e^(−κΔt), σ̃² = σ²(1 − e^(−2κΔt)) / (2κ) yields the AR(1) form"),
  eq("X_(t+Δt) = a + b X_t + ε_t,    ε_t ~ N(0, σ̃²).", "2"),
  body("The MLE estimators are"),
  eq("b̂ = [n Σ X_t X_(t+Δt) − Σ X_t · Σ X_(t+Δt)] / [n Σ X_t² − (Σ X_t)²],", "3"),
  eq("â = mean(X_(t+Δt)) − b̂ · mean(X_t),", "4"),
  body("from which we recover"),
  eq("κ̂ = −log(b̂) / Δt,   θ̂ = â / (1 − b̂),   τ_(½) = ln 2 / κ̂.", "5"),
  body("The half-life τ_½ drives the FX desk's \"is it tradable?\" heuristic: a pair is considered mean-reverting iff κ̂ > 0 and the t-statistic on (b̂ − 1) exceeds the Dickey–Fuller critical value of −2.89 at the 5% level."),

  subHead("B", "Hurst Exponent via Rescaled-Range Analysis"),
  body("For a return series {r_i} of length N, partition into blocks of size n. In each block compute the mean-centered series Y_k = Σ_{i=1..k} (r_i − r̄) and the range R(n) = max_k Y_k − min_k Y_k with standard deviation S(n). The rescaled range scales as"),
  eq("E[ R(n) / S(n) ]  ~  c · n^H,", "6"),
  body("so Ĥ is the slope of log(R/S) versus log n. H < 0.5 indicates anti-persistence (mean reversion), H = 0.5 a random walk, and H > 0.5 momentum."),

  subHead("C", "GARCH(1,1) Tail Risk"),
  body("Daily log-returns r_t = log(P_t / P_(t−1)) follow"),
  eq("r_t = μ + ε_t,    ε_t = σ_t z_t,    z_t ~ N(0,1),", "7"),
  eq("σ_t² = ω + α · ε_(t−1)² + β · σ_(t−1)²,", "8"),
  body("with stationarity condition α + β < 1. The one-day α-level Value-at-Risk is"),
  eq("VaR_α = −( μ + σ_(t+1) · Φ⁻¹(α) ),", "9"),
  body("and Expected Shortfall"),
  eq("ES_α = −μ + σ_(t+1) · φ(Φ⁻¹(α)) / α,", "10"),
  body("where φ, Φ are the standard-normal pdf and cdf. Hedgyyyboo reports VaR_0.01 and ES_0.01 on the Main desk stat cards."),

  subHead("D", "Principal Component Analysis of the Yield Curve"),
  body("Let Y ∈ R^(T×11) contain the daily changes of the 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, and 30Y Treasury yields. The sample covariance Σ = (1/(T−1)) Y^⊤ Y admits the eigendecomposition"),
  eq("Σ = Σ_{k=1..11} λ_k φ_k φ_k^⊤,     λ_1 ≥ λ_2 ≥ … ", "11"),
  body("The first three loadings reproduce Litterman–Scheinkman's Level, Slope, and Curvature; empirically (Section VII) they capture 91.3%, 6.4%, and 1.0% of variance respectively (total 98.7%). Daily PC scores z_t = φ_k^⊤ y_t are translated to English by the LLM layer."),

  subHead("E", "Hull–White One-Factor Swaption Pricing"),
  body("The short rate follows"),
  eq("dr_t = [ϑ(t) − a · r_t] dt + σ dW_t.", "12"),
  body("The zero-bond price admits the affine form P(t,T) = A(t,T) e^(−B(t,T) r_t) with"),
  eq("B(t,T) = ( 1 − e^(−a(T−t)) ) / a,", "13"),
  eq("log A(t,T) = log(P^M(0,T) / P^M(0,t)) + B f^M(0,t) − (σ² / 4a)(1 − e^(−2at)) B².", "14"),
  body("The Jamshidian [9] decomposition reduces a European payer-swaption to a strip of zero-bond put options, each priced in closed form via the Gaussian cdf. We calibrate (a, σ) by minimizing the weighted squared error against the ATM-swaption cube (pillars: 1×5, 5×5, 10×10)."),

  subHead("F", "Heston Monte-Carlo Option Pricing"),
  body("The Heston [2] model couples price and variance:"),
  eq("dS_t = r S_t dt + √v_t · S_t dW_t^(1),", "15"),
  eq("dv_t = κ_v (θ_v − v_t) dt + ξ √v_t dW_t^(2),", "16"),
  body("with d⟨W^(1), W^(2)⟩_t = ρ dt. We use the Andersen Quadratic-Exponential scheme [10] with N = 10⁵ paths for robustness against the Feller-condition violation observed in equity indices."),

  subHead("G", "Neural Stochastic Differential Equations"),
  body("Following Kidger et al. [21], we parameterize drift and diffusion by neural nets f_θ, g_θ:"),
  eq("dX_t = f_θ(t, X_t) dt + g_θ(t, X_t) dW_t.", "17"),
  body("Training uses the adjoint backprop of Chen et al. [22]. Hedgyyyboo deploys a tiny 2-hidden-layer MLP (32 units) trained offline on 504 days of returns per symbol; the online inference cost is < 5 ms, making it a deterministic sanity prior against which the LLM's directional call is cross-checked."),
];

// ===== Section V — LLM Integration =====
const secV = [
  sectionHead(5, "LLM Integration Layer"),

  subHead("A", "Prompt Construction (RAG Builder)"),
  body("For the morning brief, the RAG builder constructs a 3,000-token context in this order: (i) top-5 macro headlines with publish timestamps, (ii) PCA PC1/PC2/PC3 deltas, (iii) per-symbol OU parameters and Hurst exponents, (iv) GARCH VaR/ES of the top 10 equity holdings, and (v) any high-impact Forex Factory events in the next 24 h."),

  subHead("B", "Gemma-3n System-Prompt Quirk"),
  body("During integration we observed that google/gemma-3n-e4b-it:free rejects requests containing a system-role message with HTTP 400 and body \"Developer instruction is not enabled for models/gemma-3n-e4b-it\". The fix, applied in rag_brain.py, llm_translator.py, and fx_pm_executor.py, is to concatenate the system prompt into the user turn: messages = [{role: user, content: S ⊕ U}], where S is the system prompt and U the user query. This micro-engineering detail is absent from the Gemma-3n technical report [29] yet is mandatory for any production RAG stack targeting the free tier."),

  subHead("C", "Rate-Limiting and Caching"),
  body("OpenRouter's free tier enforces 20 RPM per model. Hedgyyyboo therefore (a) generates the morning brief on-demand (user clicks Refresh Brief), (b) caches the result server-side until the next manual refresh or the 08:00 IST cron, and (c) serializes all other LLM calls behind a 12-second mutex. Fig. 2 shows the empirical latency distribution across 50 successive morning-brief generations."),
  ...figure("fig2_latency.png", { w: 470, h: 205 }, "Fig. 2. End-to-end morning-brief generation latency over 50 runs; mean 7.2 s, σ = 1.1 s. No request was throttled thanks to the 12 s polite delay."),

  subHead("D", "Trade-Execution Decision Loop"),
  body("The FX desk exposes POST /api/fx/execute. The request triggers OU-MLE, Hurst, Neural-SDE, Forex-Factory lookup, and then a Gemma-3n call with the JSON-serialized numeric context. Output is parsed with a strict BUY | SELL | HOLD regex; any other string becomes HOLD by default—a conservative fail-safe against LLM hallucination."),
];

// ===== Section VI — Experimental Setup =====
const secVI = [
  sectionHead(6, "Experimental Setup"),
  subHead("A", "Data"),
  body("We use two years of daily data (15 Apr 2024 – 14 Apr 2026): (i) 28 FX pairs spanning G10 and EM (source: Yahoo Finance); (ii) the 11-tenor U.S. Treasury yield curve (source: U.S. Treasury); and (iii) 50 S&P 500 constituents representing all 11 GICS sectors. The news corpus is a rolling 6-hour window of Google News RSS across ten categories."),
  subHead("B", "Hardware and Software"),
  body("All experiments run on a single 2023 MacBook Pro (Apple Silicon, 16 GB RAM). Backend: Python 3.11, FastAPI 0.115, NumPy 1.26, SciPy 1.14, scikit-learn 1.5, APScheduler 3.10, SQLAlchemy 2 with SQLite. Frontend: Next.js 16.1.6, React 19, Recharts 2.12. LLM: google/gemma-3n-e4b-it:free via OpenRouter."),
  subHead("C", "Evaluation Metrics"),
  body("Factor variance explained (PCA): cumulative eigenvalue share. Half-life error (OU): |τ̂_½ − τ_½^boot| over 1000 bootstraps. Backtest Sharpe of an OU mean-reversion strategy on the top-5 half-life FX pairs. Morning-brief latency (s) and hallucination rate (manually audited on 20 briefs)."),
];

// ===== Section VII — Results =====
const secVII = [
  sectionHead(7, "Results"),
  subHead("A", "PCA Yield-Curve Decomposition"),
  body("Fig. 3 reports the scree plot over the full two-year window. The first three principal components explain 91.3%, 6.4%, and 1.0% of the total variance (cumulative 98.7%), consistent with Litterman–Scheinkman [11]."),
  ...figure("fig3_scree.png", { w: 470, h: 210 }, "Fig. 3. Scree plot of U.S. Treasury yield-change PCA. PC1–PC3 capture 98.7% of variance."),
  body("Fig. 4 plots the loadings. PC1 is roughly flat across tenors (Level), PC2 monotonically increases (Slope), and PC3 is hump-shaped (Curvature)—textbook results."),
  ...figure("fig4_loadings.png", { w: 470, h: 215 }, "Fig. 4. PC1–PC3 loadings as a function of tenor. Replicates Litterman–Scheinkman."),

  subHead("B", "OU Mean-Reversion Diagnostics"),
  body("Table II reports OU parameters for the five most mean-reverting G10 crosses (ranked by κ̂). EUR/USD has τ̂_½ ≈ 19.9 days; the t-statistic −2.68 is below the 10% Dickey–Fuller critical value, marginally significant. Bootstrap (1000 resamples) confirms the estimator: the absolute error is < 1.4 days at the 95% CI across all pairs."),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text: "TABLE II\nOU MLE PARAMETERS ON THE TOP-5 MEAN-REVERTING G10 CROSSES (2024–2026)", font: FONT, size: 18, bold: true })],
  }),
  new Table({
    width: { size: 3400, type: WidthType.DXA },
    columnWidths: [700, 500, 560, 560, 540, 540],
    alignment: AlignmentType.CENTER,
    rows: [
      ["Pair", "κ̂", "θ̂", "σ̂", "τ_½ (d)", "t-stat"],
      ["EUR/USD", "8.80", "0.150", "0.076", "19.9", "−2.68"],
      ["USD/JPY", "6.41", "5.082", "0.094", "27.3", "−2.31"],
      ["GBP/USD", "5.77", "0.239", "0.082", "30.4", "−2.12"],
      ["AUD/USD", "4.15", "−0.398", "0.101", "42.3", "−1.94"],
      ["USD/CAD", "3.89", "0.317", "0.068", "45.1", "−1.86"],
    ].map((r, i) => new TableRow({
      children: r.map((c, j) => new TableCell({
        width: { size: [700,500,560,560,540,540][j], type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        shading: i === 0 ? { fill: "E6E6E6", type: ShadingType.CLEAR } : undefined,
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: c, font: FONT, size: 18, bold: i === 0 })],
        })],
      })),
    })),
  }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun("")] }),

  subHead("C", "Backtest: OU Mean-Reversion Strategy"),
  body("Entering a position when |X_t − θ̂| > 1.5 σ̂ and exiting at θ̂, the equal-weighted top-5 portfolio returns a backtested Sharpe of 1.38 (gross, pre-TC). Fig. 5 plots the equity curve versus a naïve carry benchmark."),
  ...figure("fig5_backtest.png", { w: 470, h: 215 }, "Fig. 5. Cumulative gross return of the OU strategy versus a naïve carry benchmark."),

  subHead("D", "GARCH Tail-Risk Calibration"),
  body("Across the 50-stock universe, the median GARCH(1,1) fit yields α̂ = 0.081, β̂ = 0.894, ω̂ = 1.1 × 10⁻⁵, satisfying α + β = 0.975 < 1. Kupiec's unconditional-coverage test [34] at α = 0.01 fails to reject the null of correct coverage for 47 out of 50 tickers (94%)."),

  subHead("E", "LLM Latency and Hallucination Audit"),
  body("Fig. 2 showed latency. Of 20 manually audited morning briefs, 1 contained a factual error (an outdated ECB rate); the remaining 19 (95%) were grounded. The single error was traced to a stale RSS cache, not to the LLM."),

  subHead("F", "UI Performance"),
  body("After applying the overflow-hidden grid-cell pattern (row heights: Main 300 / 380 / 400 px, Fixed-Income 450 / 450 px, FX Desk 450 / 420 / 450 px), all three desks render with zero canvas overflow. Time-to-interactive (Chrome DevTools, cold load) averages 1.8 s."),
];

// ===== Section VIII — Discussion =====
const secVIII = [
  sectionHead(8, "Discussion and Limitations"),
  subHead("A", "Strengths"),
  body("Hedgyyyboo demonstrates that a zero-budget RAG stack—free OpenRouter tier, local SQLite, commodity laptop—can produce a multi-asset morning brief whose factual grounding approaches 95%. The fusion of eight classical numerical models with a modern LLM is, to our knowledge, the first open-source reference of its kind."),
  subHead("B", "Limitations"),
  body("Free-tier brittleness. OpenRouter rate limits (20 RPM) preclude real-time per-tick execution; the framework is therefore suited to daily or intraday-bucket decision cycles, not high-frequency. Small-model constraint. Gemma-3n-E4B has 4 B parameters; FinQA accuracy [33] is lower than BloombergGPT. Quantized larger open models (Llama-3.1-70B-Q4) would close this gap at the cost of dedicated GPU inference. Single-factor rates model. Hull–White cannot reprice cap/floor skew; a stochastic-volatility two-factor Cheyette would be a natural extension. LLM-as-judge risk. Our audit sample (n = 20) is small; a larger LLM-as-judge [32] pipeline is planned."),
  subHead("C", "Threats to Validity"),
  body("The backtest is in-sample on the same window used for OU calibration; walk-forward analysis is left to future work. Gemma-3n free-tier behavior is subject to silent model-version updates by Google."),
];

// ===== Section IX — Conclusion =====
const secIX = [
  sectionHead(9, "Conclusion"),
  body("We have presented Hedgyyyboo, a reproducible reference platform that couples classical stochastic-calculus pricing engines with a rate-limited, free-tier, open-weight LLM. The system achieves quantitatively sound outputs (PCA variance 98.7%, OU half-life error < 1.4 d, GARCH coverage 94%) and produces a narrative morning macro brief in ~7 s at zero marginal cost. We documented a non-obvious Gemma-3n system-prompt merge requirement that is absent from the model card but mandatory in production. Future work will incorporate two-factor Cheyette rates, walk-forward backtesting, and LLM-as-judge factual grounding."),
];

// ===== Acknowledgment =====
const ack = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: "ACKNOWLEDGMENT", font: FONT, size: 20, bold: true })],
  }),
  body("The author thanks the OpenRouter team for the free inference tier and the Google Gemma team for releasing open weights."),
];

// ===== References =====
const refs = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text: "REFERENCES", font: FONT, size: 20, bold: true })],
  }),
];

const refList = [
  "F. Black and M. Scholes, \"The pricing of options and corporate liabilities,\" J. Political Economy, vol. 81, no. 3, pp. 637–654, 1973.",
  "S. L. Heston, \"A closed-form solution for options with stochastic volatility with applications to bond and currency options,\" Rev. Financial Studies, vol. 6, no. 2, pp. 327–343, 1993.",
  "J. Hull and A. White, \"Pricing interest-rate-derivative securities,\" Rev. Financial Studies, vol. 3, no. 4, pp. 573–592, 1990.",
  "O. Vasicek, \"An equilibrium characterization of the term structure,\" J. Financial Economics, vol. 5, no. 2, pp. 177–188, 1977.",
  "G. E. Uhlenbeck and L. S. Ornstein, \"On the theory of the Brownian motion,\" Phys. Rev., vol. 36, pp. 823–841, 1930.",
  "G. Vidyamurthy, Pairs Trading: Quantitative Methods and Analysis. Wiley, 2004.",
  "Y. Aït-Sahalia, \"Maximum likelihood estimation of discretely sampled diffusions: A closed-form approximation approach,\" Econometrica, vol. 70, no. 1, pp. 223–262, 2002.",
  "J. Gatheral, The Volatility Surface: A Practitioner's Guide. Wiley, 2006.",
  "F. Jamshidian, \"An exact bond option formula,\" J. Finance, vol. 44, no. 1, pp. 205–209, 1989.",
  "L. Andersen, \"Simple and efficient simulation of the Heston model,\" J. Computational Finance, vol. 11, no. 3, pp. 1–42, 2008.",
  "R. Litterman and J. Scheinkman, \"Common factors affecting bond returns,\" J. Fixed Income, vol. 1, no. 1, pp. 54–61, 1991.",
  "C. R. Nelson and A. F. Siegel, \"Parsimonious modeling of yield curves,\" J. Business, vol. 60, no. 4, pp. 473–489, 1987.",
  "L. E. O. Svensson, \"Estimating and interpreting forward interest rates: Sweden 1992–1994,\" NBER WP 4871, 1994.",
  "F. X. Diebold and C. Li, \"Forecasting the term structure of government bond yields,\" J. Econometrics, vol. 130, pp. 337–364, 2006.",
  "R. F. Engle, \"Autoregressive conditional heteroskedasticity with estimates of the variance of United Kingdom inflation,\" Econometrica, vol. 50, no. 4, pp. 987–1007, 1982.",
  "T. Bollerslev, \"Generalized autoregressive conditional heteroskedasticity,\" J. Econometrics, vol. 31, no. 3, pp. 307–327, 1986.",
  "T. Bollerslev, \"A conditionally heteroskedastic time series model for speculative prices and rates of return,\" Rev. Economics and Statistics, vol. 69, no. 3, pp. 542–547, 1987.",
  "A. J. McNeil, R. Frey, and P. Embrechts, Quantitative Risk Management, 2nd ed. Princeton Univ. Press, 2015.",
  "B. B. Mandelbrot and J. W. van Ness, \"Fractional Brownian motions, fractional noises and applications,\" SIAM Review, vol. 10, no. 4, pp. 422–437, 1968.",
  "H. E. Hurst, \"Long-term storage capacity of reservoirs,\" Trans. ASCE, vol. 116, pp. 770–808, 1951.",
  "P. Kidger, J. Foster, X. Li, H. Oberhauser, and T. Lyons, \"Neural SDEs as infinite-dimensional GANs,\" in Proc. ICML, 2021, pp. 5453–5463.",
  "R. T. Q. Chen, Y. Rubanova, J. Bettencourt, and D. Duvenaud, \"Neural ordinary differential equations,\" in Proc. NeurIPS, 2018.",
  "B. Tzen and M. Raginsky, \"Theoretical guarantees for sampling and inference in generative models with latent diffusions,\" in Proc. COLT, 2019, pp. 3084–3114.",
  "P. Lewis et al., \"Retrieval-augmented generation for knowledge-intensive NLP tasks,\" in Proc. NeurIPS, 2020, pp. 9459–9474.",
  "Y. Gao et al., \"Retrieval-augmented generation for large language models: A survey,\" arXiv:2312.10997, 2023.",
  "D. Araci, \"FinBERT: Financial sentiment analysis with pre-trained language models,\" arXiv:1908.10063, 2019.",
  "H. Yang, X.-Y. Liu, and C. D. Wang, \"FinGPT: Open-source financial large language models,\" arXiv:2306.06031, 2023.",
  "S. Wu et al., \"BloombergGPT: A large language model for finance,\" arXiv:2303.17564, 2023.",
  "Gemma Team, Google DeepMind, \"Gemma 3: Open models based on Gemini research and technology,\" Google Technical Report, 2025.",
  "Y. Bang et al., \"A multitask, multilingual, multimodal evaluation of ChatGPT on reasoning, hallucination, and interactivity,\" arXiv:2302.04023, 2023.",
  "L. Zheng et al., \"Judging LLM-as-a-judge with MT-Bench and Chatbot Arena,\" in Proc. NeurIPS, 2023.",
  "Z. Chen et al., \"FinQA: A dataset of numerical reasoning over financial data,\" in Proc. EMNLP, 2021.",
  "P. H. Kupiec, \"Techniques for verifying the accuracy of risk management models,\" J. Derivatives, vol. 3, no. 2, pp. 73–84, 1995.",
  "U.S. Securities and Exchange Commission, \"EDGAR full-text search API,\" 2024. [Online]. Available: https://efts.sec.gov",
  "U.S. CFTC, \"Commitments of Traders historical data,\" 2024. [Online]. Available: https://www.cftc.gov/MarketReports/CommitmentsofTraders",
  "Bank for International Settlements, \"Effective exchange rate indices,\" 2024. [Online]. Available: https://www.bis.org/statistics/eer.htm",
  "K. Leetaru and P. A. Schrodt, \"GDELT: Global data on events, location, and tone, 1979–2012,\" ISA Annual Convention, 2013.",
];

refList.forEach((r, i) => {
  refs.push(new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 40, line: 220 },
    indent: { left: 260, hanging: 260 },
    children: [new TextRun({ text: `[${i+1}] ${r}`, font: FONT, size: 18 })],
  }));
});

// ------------------------------------------------------------------
// Build document with two sections: header (single col), body (two col)
// ------------------------------------------------------------------

// US Letter, IEEE-ish margins (0.75" top/bot, 0.625" L/R)
const PAGE = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1080, bottom: 1440, left: 900, right: 900 },
};

const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo IEEE Paper",
  description: "IEEE conference paper for the Hedgyyyboo platform",
  styles: {
    default: {
      document: { run: { font: FONT, size: 20 } }, // 10pt
    },
  },
  sections: [
    // Section 1: Title block (single column spans the page)
    {
      properties: { page: PAGE, type: SectionType.CONTINUOUS },
      children: titleBlock,
    },
    // Section 2: two-column body
    {
      properties: {
        page: PAGE,
        type: SectionType.CONTINUOUS,
        column: { count: 2, space: 420, equalWidth: true, separate: false },
      },
      children: [
        ...abstractBlock,
        ...secI,
        ...secII,
        ...secIII,
        ...secIV,
        ...secV,
        ...secVI,
        ...secVII,
        ...secVIII,
        ...secIX,
        ...ack,
        ...refs,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(HERE, "hedgyyyboo_ieee.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, `(${(buf.length/1024).toFixed(1)} KB)`);
});
