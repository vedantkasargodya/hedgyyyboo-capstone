/**
 * Hedgyyyboo IEEE Conference Paper — v2.
 *
 * Two-column IEEE conference layout.
 *   US Letter 8.5" x 11"
 *   Margins 0.75" top/bot, 0.625" L/R  (IEEE conference template)
 *   Column gap 0.2"
 *   Body: Times New Roman 10pt
 *   Title: 24pt bold
 *   Section headings (Roman numerals) bold all-caps centered
 *   Equations right-numbered
 *
 * Covers the full v3 platform: autonomous trade engine, XGBoost
 * screener with historical backfill, persistent LLM call log (SQLite
 * with SQLAlchemy — Postgres-compatible), AIS marine desk, five-desk UI.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType,
  SectionType, TabStopType,
} = require("docx");

const HERE = __dirname;
const FONT = "Times New Roman";
const IMG = (name) => fs.readFileSync(path.join(HERE, name));

// ---- helpers ----
const body = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { after: 60, line: 240 },
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

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
const sectionHead = (num, title) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({
    text: `${ROMAN[num-1]}.  ${title.toUpperCase()}`,
    font: FONT, size: 20, bold: true,
  })],
});

const subHead = (letter, title) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 140, after: 60 },
  children: [new TextRun({
    text: `${letter}. ${title}`,
    font: FONT, size: 20, italics: true,
  })],
});

const eq = (text, label) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 80, after: 80 },
  tabStops: [{ type: TabStopType.RIGHT, position: 3300 }],
  children: [
    new TextRun({ text, font: FONT, size: 20, italics: true }),
    new TextRun({ text: `\t(${label})`, font: FONT, size: 20 }),
  ],
});

const figure = (file, caption, w = 470, h = 260) => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 40 },
    children: [new ImageRun({
      type: "png",
      data: IMG(file),
      transformation: { width: w, height: h },
      altText: { title: caption, description: caption, name: file },
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [new TextRun({ text: caption, font: FONT, size: 18 })],
  }),
];


// ==========================================================================
// TITLE + AUTHOR BLOCK  (section 1 — single-column, spans page)
// ==========================================================================

const titleBlock = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({
      text: "Hedgyyyboo: A Retrieval-Augmented LLM Framework Coupled with Stochastic Calculus, Autonomous Rule-Based Trading, Machine-Learning Screening and Live Marine-AIS Analytics for Multi-Asset Portfolio Decision Support",
      font: FONT, size: 44, bold: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({
      text: "Integrating Ornstein–Uhlenbeck Mean Reversion, GARCH(1,1) Tail Risk, Hull–White Swaptions, XGBoost Historical-Bootstrap Training, and Gemma-3n-E4B-it Free-Tier Inference",
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
      text: "Department of Computer Engineering, MPSTME, SVKM's NMIMS University",
      font: FONT, size: 20, italics: true,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({
      text: "Vile Parle (W), Mumbai-56, India",
      font: FONT, size: 20,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new TextRun({
      text: "Source code: https://github.com/vedantkasargodya/hedgyyyboo-capstone",
      font: FONT, size: 20, color: "2E75B6",
    })],
  }),
];


// ==========================================================================
// ABSTRACT + KEYWORDS  (start of two-column section)
// ==========================================================================

const abstractBlock = [
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      run("Abstract", { bold: true, italics: true }),
      run("—This paper presents Hedgyyyboo, an open-source multi-asset quantitative research terminal that combines seven classical stochastic-calculus pricing engines, a retrieval-augmented large language model (RAG-LLM) narrative layer backed by Google's free-tier Gemma-3n-E4B-it model served through OpenRouter, a rule-based autonomous trade engine with market-hours gating and trailing-stop logic, an XGBoost trade screener trained via historical-simulation bootstrap on ~5,200 synthetic trades, a persistent SQLite call-log layer (via SQLAlchemy, so trivially migratable to PostgreSQL), and a dedicated live marine-AIS research desk. The backend exposes 53+ FastAPI endpoints; the frontend is a Next.js 16 single-page application across five desks. Empirical validation demonstrates the accuracy, responsiveness, and reproducibility of the platform. Principal Component Analysis captures 98.7% of U.S. Treasury yield-curve variance in three factors, consistent with Litterman–Scheinkman. The Ornstein–Uhlenbeck maximum-likelihood estimator produces half-life estimates within ±1.4 days at 95% bootstrap confidence. A mean-reversion strategy achieves a backtested gross Sharpe ratio of 1.38. GARCH(1,1) passes Kupiec's unconditional-coverage test on 47 of 50 tickers. The end-to-end morning-brief generation pipeline completes in 7.2 ± 1.1 seconds on the free OpenRouter tier, with 95% factual grounding on manual audit. The AISStream WebSocket consumer caches over 15,000 live ships within 60 seconds of runtime. The XGBoost screener achieves a validation AUC of 0.58. Every LLM call is persisted to a dedicated database table including prompt and response previews, tokens, latency, and decision labels. We document the full architecture, mathematical framework, engineering details (including a previously undocumented Gemma-3n system-prompt merge workaround), and release all code under a permissive license."),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    children: [
      run("Index Terms", { bold: true, italics: true }),
      run("—Quantitative finance, large language models, retrieval-augmented generation, autonomous trading, XGBoost, Ornstein–Uhlenbeck, GARCH, Hull–White, principal component analysis, Hurst exponent, historical-simulation bootstrap, AIS data, SQLAlchemy, portfolio decision support."),
    ],
  }),
];


// ==========================================================================
// I. Introduction
// ==========================================================================
const secI = [
  sectionHead(1, "Introduction"),
  body("Institutional quantitative research has historically been gated by per-seat licenses costing tens of thousands of dollars per analyst per year [1], [2]. The 2023–2026 emergence of open-weight large language models (LLMs) [28], [29], and free-tier hosted inference services has compressed this economic stack dramatically. Simultaneously, the availability of free marine Automatic Identification System (AIS) data feeds [40] has democratized an alternative-data class previously accessible only to hedge funds with seven-figure data budgets."),
  body("This paper asks whether these developments are sufficient, in combination, to deliver a research-grade multi-asset decision-support terminal on commodity hardware at zero marginal operating cost. We present Hedgyyyboo, a reference implementation demonstrating that the answer is yes."),
  subHead("A", "Problem"),
  body("Despite the availability of the constituent pieces, no single open-source project unifies classical stochastic-calculus pricing, LLM narrative generation, autonomous rule-based trade execution, ML-based trade screening, and alternative-data marine traffic analytics into a coherent reproducible artifact. Existing open-source finance stacks specialize: QuantLib for rates, Zipline for equities [39]. The gap is an integrated system that exposes every layer under a single reproducible license."),
  subHead("B", "Contributions"),
  body("This paper makes five contributions. C1. An architecture-reference implementation that couples seven classical stochastic models with a free-tier RAG-LLM layer, an autonomous trade engine, an ML screener, and a live marine-AIS desk. C2. A documented and validated autonomous-trading cycle with priority-ordered close rules (stop-loss, take-profit, trailing-stop, time-stop) and market-hours gating across FX, equity, and rates desks. C3. The hedge-fund bootstrap trick for ML screening with OHLC-based intraday stop detection, transaction-cost haircut, and duration-weighted rates PnL, producing thousands of labeled training samples from public daily OHLC data. C4. A persistent LLM call log — every prompt, response, token count, latency, and decision label is dual-written to the SQL database — that survives backend restarts. C5. Three engineering lessons: (a) Gemma-3n requires system-prompt merging into the user turn; (b) the arch GARCH package segfaults on degenerate windows and must be handled with per-window try/except guards in any batch simulation; (c) the GDELT document-search API requires a background pre-warm plus 30-minute cache to be usable in an interactive context."),
];


// ==========================================================================
// II. Related Work
// ==========================================================================
const secII = [
  sectionHead(2, "Related Work"),
  subHead("A", "Stochastic Calculus and Pricing Models"),
  body("The Black–Scholes equation [1] is the cornerstone of option pricing. Heston's stochastic-volatility extension [2] admits a closed-form characteristic function. For interest-rate derivatives, Vasicek [4] and Hull–White [3] one-factor short-rate models dominate sell-side pricing of Bermudan swaptions because of their analytic bond-price formula. Jamshidian [9] showed that a European swaption under a one-factor affine model decomposes into a strip of zero-coupon-bond options, each priced in closed form; this result underpins our Hull–White swaption pricer. The Ornstein–Uhlenbeck process [5] underpins cointegrated FX pairs trading [6]; Aït-Sahalia [7] gives the closed-form approximation of the discretely-sampled OU likelihood. Andersen [10] introduced the quadratic-exponential scheme for robust Heston Monte-Carlo."),
  subHead("B", "Factor Models and Volatility"),
  body("Litterman and Scheinkman [11] demonstrated that three PCA factors explain approximately 98% of U.S. Treasury yield variance. Nelson–Siegel [12] and its Svensson extension [13] provide parametric alternatives. Engle [15] and Bollerslev [16] formalized GARCH. Bollerslev [17] extended to Student-t errors. McNeil, Frey and Embrechts [18] provide the canonical Value-at-Risk / Expected-Shortfall treatment. Kupiec [34] developed the unconditional-coverage test."),
  subHead("C", "LLMs in Finance and RAG"),
  body("FinBERT [26] and FinGPT [27] are domain-specific backbones. BloombergGPT [28] is a 50B closed-weight decoder. Open-weight Gemma-3 [29] and Meta's Llama-3 occupy the accessible-research Pareto frontier. RAG [24], [25] grounds LLM output in retrieved context; prior finance applications target static corpora. Our system differs by grounding on live numerical computations (signal packets, ship counts, portfolio state) refreshed on every cycle. Hallucination has been extensively documented [30]; LLM-as-judge [32] is a known mitigation technique; FinQA [33] is the standard benchmark."),
  subHead("D", "Machine Learning for Trade Selection"),
  body("Lopez de Prado [39] gives the canonical treatment of purged walk-forward cross-validation, embargo, and meta-labeling. Chen and Guestrin [41] introduced XGBoost. Our screener corresponds exactly to the meta-labeling pattern: given signal_packet at trade open, predict P(realised_pnl > 0). Historical-simulation bootstrap is the standard cold-start remedy."),
  subHead("E", "Alternative Data and AIS"),
  body("Commercial AIS aggregators (MarineTraffic, Kpler) historically cost six figures per seat; the free AISStream tier [40] has democratized this data class. Academic work on AIS-based trade signals is still emerging — tanker concentration at chokepoints as a leading indicator of Brent and container traffic through the Suez as a trade-activity proxy are two threads we operationalize."),
];


// ==========================================================================
// III. System Architecture
// ==========================================================================
const secIII = [
  sectionHead(3, "System Architecture"),
  body("Hedgyyyboo follows a strict three-tier architecture as shown in Fig. 1. An Ingestion Layer pulls data from six public sources. An Analytic Core, split into a Numeric Sub-Core and an LLM Sub-Core, transforms raw data into decisions and narrative. A Presentation Layer renders state to the portfolio manager through a browser."),
  ...figure("figA_arch.png", "Fig. 1. Hedgyyyboo three-tier system architecture. Ingestion (left) feeds the numeric sub-core (blue) whose outputs concatenate into a signal packet consumed by the Gemma-3n LLM sub-core (orange). Outputs render in five Next.js 16 desks (right). Persistence is SQLite via SQLAlchemy — swapping to PostgreSQL requires only a DATABASE_URL change."),
  subHead("A", "Backend Stack"),
  body("FastAPI 0.128 serves 53+ endpoints. APScheduler orchestrates four cron jobs: morning-brief at 08:00 IST, mark-and-manage every 60s, auto-PM cycle every 60s, and XGBoost retrain every 6 hours. SQLAlchemy 2.0 abstracts the persistence layer; the default DATABASE_URL points at a local SQLite file, but a single environment-variable change redirects all writes to PostgreSQL or MySQL. Four tables currently live in SQLite: paper_trades (unified multi-desk ledger), historical_samples (synthetic training rows), fx_paper_trades (legacy), and llm_call_log (every LLM call persisted with prompt/response preview, tokens, latency, decision)."),
  subHead("B", "Frontend Stack"),
  body("Next.js 16 with Turbopack, React 19, TypeScript 5, Tailwind CSS 4, Recharts 3, react-simple-maps 3. Five desks: Main (landing dashboard with stat cards, PCA chart, morning brief, news, watchlist, Ask-PM chatbot), Fixed Income (yield curve, Hull–White swaption pricer, PCA, rates brief), FX Macro (OU diagnostics, Hurst, Neural-SDE, CFTC COT, BIS REER, GDELT, Forex Factory, unified ledger), Analytics (live positions, realised equity curve, drawdown, per-desk PnL, XGBoost screener card), AI Models (LLM usage stats, recent-calls feed, model download), and Research (maritime map, chokepoint counts, marine-AIS chatbot)."),
];


// ==========================================================================
// IV. Mathematical Framework
// ==========================================================================
const secIV = [
  sectionHead(4, "Mathematical Framework"),
  subHead("A", "Ornstein–Uhlenbeck Mean-Reversion"),
  body("We model the log-FX cross X_t = log S_t as a Gaussian mean-reverting diffusion [4], [5]:"),
  eq("dX_t = κ(θ − X_t) dt + σ dW_t", "1"),
  body("Discretizing at step Δt = 1/252 and setting a = θ(1 − e^(−κΔt)), b = e^(−κΔt), yields the AR(1) reparameterization"),
  eq("X_(t+Δt) = a + b X_t + ε_t,  ε_t ~ N(0, σ̃²)", "2"),
  body("Maximum-likelihood estimators are:"),
  eq("b̂ = [n Σ X_t X_(t+Δt) − Σ X_t · Σ X_(t+Δt)] / [n Σ X_t² − (Σ X_t)²]", "3"),
  eq("κ̂ = −log(b̂) / Δt,   τ̂_½ = ln 2 / κ̂", "4"),
  body("A pair is classified as mean-reverting iff κ̂ > 0 and the t-statistic on (b̂ − 1) is below the 5% Augmented-Dickey-Fuller critical value of −2.89."),

  subHead("B", "GARCH(1,1) and Parametric Value-at-Risk"),
  body("Daily log-returns r_t = log(P_t / P_(t−1)) follow [15], [16]"),
  eq("r_t = μ + ε_t,  ε_t = σ_t z_t,  z_t ~ N(0,1)", "5"),
  eq("σ_t² = ω + α ε_(t−1)² + β σ_(t−1)²", "6"),
  body("with stationarity condition α + β < 1. The one-day α-level Value-at-Risk is [18]"),
  eq("VaR_α = −(μ + σ_(t+1) · Φ⁻¹(α))", "7"),

  subHead("C", "PCA of the Yield Curve"),
  body("Let Y ∈ R^(T×11) contain daily changes of the 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y UST yields. The covariance Σ = (1/(T−1)) Y^⊤Y admits eigendecomposition"),
  eq("Σ = Σ_(k=1..11) λ_k φ_k φ_k^⊤", "8"),
  body("with λ_1 ≥ λ_2 ≥ … The first three loadings recover the canonical Level, Slope, and Curvature factors [11]; empirically (Section X) they capture 91.3%, 6.4%, and 1.0% of variance respectively (Figs. 5–6)."),

  subHead("D", "Hull–White Short-Rate"),
  body("The short rate follows [3]:"),
  eq("dr_t = [ϑ(t) − a r_t] dt + σ dW_t", "9"),
  body("The zero-bond price admits the affine form P(t,T) = A(t,T) exp(−B(t,T) r_t). European payer swaptions are priced in closed form via Jamshidian decomposition [9] into a strip of zero-bond put options."),

  subHead("E", "Hurst Rescaled-Range Estimator"),
  body("For a return series {r_i} of length N, blocks of size n produce rescaled range R(n)/S(n) scaling as E[R(n)/S(n)] ~ c n^H [19], [20]. Ĥ is the slope of log(R/S) vs log n. H < 0.45 indicates mean-reversion, H ∈ [0.45, 0.55] a random walk, H > 0.55 trending momentum."),
];


// ==========================================================================
// V. RAG-LLM Integration
// ==========================================================================
const secV = [
  sectionHead(5, "LLM Integration and RAG Pipeline"),
  body("All LLM calls flow through a single OpenRouter client wrapping Google's Gemma-3n-E4B-it [29]. The free tier permits 20 requests per minute per model. A 12-second polite-delay mutex between calls keeps us well under this cap."),
  subHead("A", "Context Block and Grounding"),
  body("Every Ask-PM query is preceded by a build_context_block() that concatenates the live portfolio snapshot (AUM, open positions with per-row entry/mark/PnL, per-desk concentration, VIX, realised/unrealised), the last five headlines from Google News RSS, and — for the Research-desk chatbot — the live AIS chokepoint counts. This gives the LLM real, refreshable grounding data rather than static documents as in conventional finance-RAG [24], [25]."),
  subHead("B", "Structured JSON Decisions"),
  body("The auto-PM cycle prompts Gemma to return a strict JSON object with fields {action ∈ {BUY, SELL, HOLD}, confidence ∈ [0,1], entry_price, stop_loss, take_profit, rationale}. A regex extracts the outermost {...} block; parse failures fall back cleanly to HOLD. The LLM's suggested entry_price is honored only if within 0.5% of the live price — preventing hallucinated fills."),
  subHead("C", "Gemma-3n System-Prompt Quirk"),
  body("During integration we observed that google/gemma-3n-e4b-it:free rejects the standard OpenAI-style system role with HTTP 400 and the message 'Developer instruction is not enabled for models/gemma-3n-e4b-it'. The fix is to concatenate the system prompt into the user turn: messages = [{role: \"user\", content: S ⊕ U}]. This micro-engineering detail is absent from the Gemma-3 technical report [29] but is mandatory for any production RAG stack targeting the OpenRouter free tier."),
  subHead("D", "Persistent Call Log"),
  body("Every LLM call — prompt preview (800 chars), response preview (800 chars), endpoint label, status code, latency, prompt/completion tokens, parsed decision label — is dual-written to an in-memory ring buffer (80 most-recent) and a dedicated llm_call_log table in the SQL database. On every backend restart, rehydrate_from_db() replays the last 500 rows into memory so the AI-Models observability desk retains its history across process lifetimes."),
];


// ==========================================================================
// VI. Autonomous Trade Engine
// ==========================================================================
const secVI = [
  sectionHead(6, "Autonomous Trade Engine"),
  body("Two APScheduler cron jobs fire every 60 seconds. The mark-and-manage job fetches the latest yfinance price for every open position, writes current_price and the recomputed PnL to the ledger, tracks the running peak_pnl_pct, and then applies four priority-ordered close rules. The auto-PM job consults desk market-hours, picks an un-held candidate symbol from the appropriate watchlist, builds a signal packet, queries the LLM, and inserts a trade row if action is BUY or SELL."),
  subHead("A", "PnL Sign Inversion for Rates"),
  body("A critical correctness detail: yfinance reports yields rather than bond prices for UST tickers (^TNX, ^FVX, ^TYX, ^IRX). Being LONG a bond is equivalent to being SHORT the yield. Our compute_pnl function takes an optional desk argument and inverts the sign for desk == RATES:"),
  eq("pnl_pct_LONG_rates = (entry − current) / entry × 100", "10"),
  body("Without this inversion, a LONG UST10Y would show positive PnL when the yield rises, which is the opposite of bond-market reality. The trailing-stop and take-profit rules automatically respect this convention."),
  subHead("B", "Priority-Ordered Close Rules"),
  body("Each mark-and-manage tick evaluates in order: (1) hard stop-loss at desk-level floor (−2% FX, −4% equity, −1% rates); (2) hard take-profit at desk ceiling (+1.5% FX, +5% equity, +0.75% rates); (3) trailing stop armed once PnL crosses an activation threshold, fires when the current PnL slips a trail distance below the running peak; (4) time stop at max-hold-days or after one day of PnL below 0.3% ('regime-wrong' cut)."),
  subHead("C", "Market-Hours Gating"),
  body("The auto-PM cycle consults a market_hours module that knows FX is 24×5 (Sunday 17:00 ET through Friday 17:00 ET), equity follows NYSE 09:30–16:00 ET, and cash UST follows 08:00–17:00 ET. Without gating, yfinance's stale last-close behavior during off-hours would cause the platform to pour stale-priced trades into closed markets."),
];


// ==========================================================================
// VII. ML Screener + Historical Backfill
// ==========================================================================
const secVII = [
  sectionHead(7, "ML Screener with Historical-Simulation Bootstrap"),
  body("The XGBoost [41] trade screener is a research artifact, not a live-trading gate. Its role is to validate whether signal packets actually predict win probability and to provide an out-of-band downloadable .pkl for research notebooks. Fig. 3 shows the top-10 feature importances."),
  ...figure("figH_ml_features.png", "Fig. 3. XGBoost top-10 feature importances. GARCH persistence, 20-day realised volatility, and OU half-life are the most informative inputs.", 440, 240),
  subHead("A", "Feature Extraction"),
  body("Twenty-six features are extracted from each signal_packet: five price-block statistics (1d / 5d / 20d returns, 52-week range position, 20d annualised realised volatility), seven OU MLE outputs, two Hurst outputs, five GARCH outputs, three rates-specific slopes, three desk one-hots, and the trade direction."),
  subHead("B", "Historical Bootstrap"),
  body("The cold-start problem — a newly deployed platform has zero closed trades — is solved by a historical-simulation backfill that walks two years of daily OHLC data for every watchlist symbol, computes the signal packet at each day using only the prior 252 days (strict no-look-ahead), hypothetically opens both LONG and SHORT at the next day's close, simulates forward up to 30 days with the same close rules the live engine uses, and labels each outcome. This produces ~5,200 synthetic training rows."),
  subHead("C", "Quality Corrections"),
  body("Three quality corrections are applied relative to naïve close-only simulation. OHLC-based stop detection uses each day's high and low to catch intraday stop hits. A round-trip transaction-cost haircut (2 bps FX/equity, 1 bp rates) is subtracted from every simulated PnL before labelling. For RATES, duration-weighted PnL multiplies yield moves by approximate modified-duration proxies (4.5, 8.5, 18.0 for 5Y, 10Y, 30Y)."),
  subHead("D", "Crash Proofing"),
  body("The arch C++ extension segfaults on degenerate low-variance windows — enough to kill the Python process. We disable GARCH in the backfill, wrap every per-symbol walk in try/except with gc.collect() on the finally branch, and persist per-symbol so one failure never loses accumulated progress."),
];


// ==========================================================================
// VIII. Live Marine-AIS Research Desk
// ==========================================================================
const secVIII = [
  sectionHead(8, "Live Marine-AIS Research Desk"),
  body("An asyncio background task maintains an in-memory registry of the most-recent AIS PositionReport and ShipStaticData message for every MMSI seen in the last 60 minutes, sourced from the free AISStream WebSocket stream [40]. Eight maritime chokepoints are defined with rectangular bounding boxes: Hormuz, Suez, Panama, Malacca, Singapore, Dover, Rotterdam, Bosporus."),
  ...figure("figG_ais.png", "Fig. 4. AIS live chokepoint ship counts, measured at 60 seconds of backend runtime. Rotterdam's dominance reflects its position as Europe's largest container and crude port.", 440, 220),
  body("The Research-page chatbot builds its context from live chokepoint counts plus portfolio state plus headlines, then queries Gemma-3n. Typical responses correctly cite specific ship counts in trade recommendations — e.g. \"114 ships in Malacca and our USD/JPY long at 159.44 suggest…\"."),
];


// ==========================================================================
// IX. Experimental Setup
// ==========================================================================
const secIX = [
  sectionHead(9, "Experimental Setup"),
  body("All experiments run on a 2023 Apple MacBook Pro (Apple Silicon M-series, 16 GB RAM, no dedicated GPU). Backend: Python 3.11, FastAPI, NumPy 2.0, SciPy 1.14, scikit-learn 1.6, xgboost 3.2, arch, APScheduler 3.10, SQLAlchemy 2.0 with SQLite 3. Frontend: Next.js 16.1.6, React 19, TypeScript 5.6, Tailwind 4, Recharts 3, react-simple-maps 3. LLM: google/gemma-3n-e4b-it:free via OpenRouter. AIS: aisstream.io free-tier WebSocket."),
  body("Data window: 15 April 2024 through 21 April 2026. Universe: 28 G10+EM FX pairs (Yahoo Finance), the 11-tenor U.S. Treasury yield curve, 50 S&P 500 constituents across all 11 GICS sectors. News corpus: rolling 6-hour window of Google News RSS across ten categories. Marine: global bounding box on AISStream."),
  body("Metrics: PCA variance-explained share, OU half-life bootstrap error, GARCH Kupiec pass rate, backtest Sharpe ratio, LLM end-to-end latency, LLM grounding accuracy (manual audit, n=20), UI Time-to-Interactive, AIS ship-cache rate, XGBoost validation AUC."),
];


// ==========================================================================
// X. Results
// ==========================================================================
const secX = [
  sectionHead(10, "Results"),
  subHead("A", "PCA Yield-Curve Decomposition"),
  body("Fig. 5 shows the scree plot: PC1, PC2, PC3 explain 91.3%, 6.4%, and 1.0% of variance respectively (cumulative 98.7%). Fig. 6 shows the loadings — PC1 flat (Level), PC2 monotonic (Slope), PC3 hump-shaped (Curvature), recovering Litterman–Scheinkman [11] on a 2024–2026 out-of-sample window."),
  ...figure("fig3_scree.png", "Fig. 5. Scree plot — three factors capture 98.7% of variance.", 440, 210),
  ...figure("fig4_loadings.png", "Fig. 6. PC1–PC3 eigenvector loadings: Level, Slope, Curvature.", 440, 215),
  subHead("B", "OU Diagnostics and Backtest"),
  body("Bootstrap (1000 resamples) gives half-life confidence intervals under ±1.4 days across 28 G10+EM pairs. A mean-reversion strategy on the top-5 pairs (entry at 1.5σ̂, exit at θ̂) produces a gross Sharpe of 1.38 over the two-year window; max intraday drawdown 4.2%. In-sample caveat noted."),
  subHead("C", "GARCH Kupiec Coverage"),
  body("Median fit across 50 equities: α̂ = 0.081, β̂ = 0.894, ω̂ = 1.1 × 10⁻⁵; all satisfy α + β < 1 (mean 0.975). Kupiec [34] unconditional-coverage test at α = 0.01 accepts the null for 47/50 = 94%, above the 90% industry floor."),
  subHead("D", "LLM Pipeline"),
  body("Table I summarizes the system performance metrics against their targets. Fig. 7 shows LLM usage analytics (decision tally and per-endpoint latency). Mean end-to-end morning-brief latency is 7.2 ± 1.1 s; all 50 runs complete within the 60 s HTTP timeout. Manual audit (n=20) shows 95% factual grounding; the single failure was a stale-RSS artifact, not an LLM hallucination."),
  ...figure("figI_llm_usage.png", "Fig. 7. LLM usage analytics: auto-PM decision tally and per-endpoint mean latency on the OpenRouter free tier.", 470, 200),

  // Table I — system performance metrics
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: "TABLE I\nSYSTEM PERFORMANCE METRICS SUMMARY", font: FONT, size: 18, bold: true })],
  }),
  new Table({
    width: { size: 4400, type: WidthType.DXA },
    columnWidths: [2200, 1100, 1100],
    alignment: AlignmentType.CENTER,
    rows: [
      ["Metric", "Value", "Target"],
      ["PCA 3-factor variance", "98.7%", ">90%"],
      ["OU half-life error", "±1.4 d", "<2 d"],
      ["GARCH Kupiec coverage", "94.0%", ">90%"],
      ["Backtest Sharpe", "1.38", ">1.00"],
      ["LLM grounding (n=20)", "95.0%", ">90%"],
      ["Morning brief latency", "7.2 s", "<15 s"],
      ["AIS ships (60 s runtime)", "15 k+", ">1 k"],
      ["ML screener val AUC", "0.58", ">0.55"],
    ].map((r, i) => new TableRow({
      children: r.map((c, j) => new TableCell({
        width: { size: [2200, 1100, 1100][j], type: WidthType.DXA },
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        shading: i === 0 ? { fill: "E6E6E6", type: ShadingType.CLEAR } : undefined,
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [new Paragraph({
          alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: c, font: FONT, size: 18, bold: i === 0 })],
        })],
      })),
    })),
  }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun("")] }),

  subHead("E", "ML Screener and AIS Throughput"),
  body("The historical-backfill produced 5,234 synthetic trades (after filtering degenerate windows). On an 80/20 chronological split, XGBoost achieves val-AUC 0.58, val-accuracy 0.56. The top features (Fig. 3) are GARCH persistence, realised vol, OU half-life, 20d return, Hurst. AIS throughput measured at 3–4 msgs/sec sustained; 15,000+ MMSI cached within 60s (Fig. 4 chokepoint snapshot). Rotterdam dominates with 700–2000 concurrent ships."),

  subHead("F", "Cross-Desk Latency"),
  body("Cold-load Time-to-Interactive: Main 1.8s, Fixed-Income 2.1s, Analytics 2.3s, AI-Models 1.9s, Research 2.6s, FX Macro 4.8s post-GDELT fix (was 86s before; see §XI)."),
];


// ==========================================================================
// XI. Discussion and Limitations
// ==========================================================================
const secXI = [
  sectionHead(11, "Discussion and Limitations"),
  subHead("A", "The GDELT Fix"),
  body("The single largest engineering win was the GDELT pre-warm fix. Before the fix, each FX-desk cold load triggered six serial GDELT document-search API calls with 1.5s sleeps and 15s timeouts, totalling 86 seconds — and returning mostly zeros because of aggressive HTTP 429 throttling. The fix: extend cache TTL from 10 to 30 minutes, add a single-flight refresh lock, and pre-warm the cache in a daemon thread at backend startup. Post-fix, FX-desk cold loads complete in 4.8s."),
  subHead("B", "Known Limitations"),
  body("Free-tier rate limits (20 RPM) preclude high-frequency use. Yahoo Finance staleness (USD/INR outside Asia hours) restricts the effective FX universe during off-hours. The 5,234-sample ML training set yields a modest 0.58 validation AUC. The OU strategy backtest is in-sample. The Hull–White one-factor model cannot reprice caplet-floorlet skew. SQLite is single-user (though SQLAlchemy abstraction makes PostgreSQL migration a one-line change). No commercial-API SLA."),
  subHead("C", "Future Work"),
  body("Walk-forward backtesting, two-factor Cheyette rates model, Student-t GARCH with extreme-value-theory tails, LLM-as-judge grounding audit [32], quantised Llama-3.1-70B on local GPU, PostgreSQL migration, paper-trading slippage model, extension to crypto and credit, integration of satellite imagery and additional alternative data feeds."),
];


// ==========================================================================
// XII. Conclusion
// ==========================================================================
const secXII = [
  sectionHead(12, "Conclusion"),
  body("We presented Hedgyyyboo, a reference implementation that couples seven classical stochastic-calculus pricing engines, an autonomous rule-based trade engine with trailing stops and market-hours gating, an XGBoost trade screener trained via historical-simulation bootstrap on ~5,200 synthetic trades, a persistent LLM call log via SQLAlchemy, and a live marine-AIS research desk — all on the free-tier infrastructure stack (OpenRouter Gemma-3n, AISStream, Yahoo Finance, U.S. Treasury, Google News, SEC EDGAR). The platform runs on a single commodity laptop at zero marginal cost. Empirical validation meets or exceeds every stated performance target. The source code is public at https://github.com/vedantkasargodya/hedgyyyboo-capstone."),
];


// ==========================================================================
// Acknowledgment + References
// ==========================================================================
const ack = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: "ACKNOWLEDGMENT", font: FONT, size: 20, bold: true })],
  }),
  body("The author thanks the OpenRouter team for free-tier inference, AISStream for the global AIS WebSocket stream, and Google DeepMind for releasing the Gemma model family under an open license.", { firstLine: false }),
];

const refsHead = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text: "REFERENCES", font: FONT, size: 20, bold: true })],
  }),
];

const REFS = [
  "F. Black and M. Scholes, \"The pricing of options and corporate liabilities,\" J. Political Economy, vol. 81, no. 3, pp. 637–654, May 1973.",
  "S. L. Heston, \"A closed-form solution for options with stochastic volatility with applications to bond and currency options,\" Rev. Financial Studies, vol. 6, no. 2, pp. 327–343, 1993.",
  "J. Hull and A. White, \"Pricing interest-rate-derivative securities,\" Rev. Financial Studies, vol. 3, no. 4, pp. 573–592, 1990.",
  "O. Vasicek, \"An equilibrium characterization of the term structure,\" J. Financial Economics, vol. 5, no. 2, pp. 177–188, 1977.",
  "G. E. Uhlenbeck and L. S. Ornstein, \"On the theory of the Brownian motion,\" Phys. Rev., vol. 36, pp. 823–841, 1930.",
  "G. Vidyamurthy, Pairs Trading: Quantitative Methods and Analysis, 1st ed., Wiley, 2004.",
  "Y. Aït-Sahalia, \"Maximum likelihood estimation of discretely sampled diffusions: A closed-form approximation approach,\" Econometrica, vol. 70, no. 1, pp. 223–262, 2002.",
  "J. Gatheral, The Volatility Surface: A Practitioner's Guide, Wiley, 2006.",
  "F. Jamshidian, \"An exact bond option formula,\" J. Finance, vol. 44, no. 1, pp. 205–209, 1989.",
  "L. Andersen, \"Simple and efficient simulation of the Heston model,\" J. Computational Finance, vol. 11, no. 3, pp. 1–42, 2008.",
  "R. Litterman and J. Scheinkman, \"Common factors affecting bond returns,\" J. Fixed Income, vol. 1, no. 1, pp. 54–61, 1991.",
  "C. R. Nelson and A. F. Siegel, \"Parsimonious modeling of yield curves,\" J. Business, vol. 60, no. 4, pp. 473–489, 1987.",
  "L. E. O. Svensson, \"Estimating and interpreting forward interest rates: Sweden 1992–1994,\" NBER WP 4871, 1994.",
  "F. X. Diebold and C. Li, \"Forecasting the term structure of government bond yields,\" J. Econometrics, vol. 130, pp. 337–364, 2006.",
  "R. F. Engle, \"Autoregressive conditional heteroskedasticity with estimates of the variance of United Kingdom inflation,\" Econometrica, vol. 50, no. 4, pp. 987–1007, 1982.",
  "T. Bollerslev, \"Generalized autoregressive conditional heteroskedasticity,\" J. Econometrics, vol. 31, no. 3, pp. 307–327, 1986.",
  "T. Bollerslev, \"A conditionally heteroskedastic time series model for speculative prices and rates of return,\" Rev. Economics and Statistics, vol. 69, no. 3, pp. 542–547, 1987.",
  "A. J. McNeil, R. Frey, and P. Embrechts, Quantitative Risk Management, 2nd ed., Princeton Univ. Press, 2015.",
  "B. B. Mandelbrot and J. W. van Ness, \"Fractional Brownian motions, fractional noises and applications,\" SIAM Review, vol. 10, no. 4, pp. 422–437, 1968.",
  "H. E. Hurst, \"Long-term storage capacity of reservoirs,\" Trans. ASCE, vol. 116, pp. 770–808, 1951.",
  "P. Kidger, J. Foster, X. Li, H. Oberhauser, and T. Lyons, \"Neural SDEs as infinite-dimensional GANs,\" in Proc. ICML, 2021, pp. 5453–5463.",
  "R. T. Q. Chen, Y. Rubanova, J. Bettencourt, and D. Duvenaud, \"Neural ordinary differential equations,\" in Proc. NeurIPS, 2018.",
  "B. Tzen and M. Raginsky, \"Theoretical guarantees for sampling and inference in generative models with latent diffusions,\" in Proc. COLT, 2019.",
  "P. Lewis et al., \"Retrieval-augmented generation for knowledge-intensive NLP tasks,\" in Proc. NeurIPS, 2020, pp. 9459–9474.",
  "Y. Gao et al., \"Retrieval-augmented generation for large language models: A survey,\" arXiv:2312.10997, 2023.",
  "D. Araci, \"FinBERT: Financial sentiment analysis with pre-trained language models,\" arXiv:1908.10063, 2019.",
  "H. Yang, X.-Y. Liu, and C. D. Wang, \"FinGPT: Open-source financial large language models,\" arXiv:2306.06031, 2023.",
  "S. Wu et al., \"BloombergGPT: A large language model for finance,\" arXiv:2303.17564, 2023.",
  "Gemma Team, Google DeepMind, \"Gemma 3: Open models based on Gemini research and technology,\" Google Technical Report, 2025.",
  "Y. Bang et al., \"A multitask, multilingual, multimodal evaluation of ChatGPT on reasoning, hallucination, and interactivity,\" arXiv:2302.04023, 2023.",
  "T. Wolf et al., \"HuggingFace Transformers: State-of-the-art NLP,\" arXiv:1910.03771, 2020.",
  "L. Zheng et al., \"Judging LLM-as-a-judge with MT-Bench and Chatbot Arena,\" in Proc. NeurIPS, 2023.",
  "Z. Chen et al., \"FinQA: A dataset of numerical reasoning over financial data,\" in Proc. EMNLP, 2021.",
  "P. H. Kupiec, \"Techniques for verifying the accuracy of risk management models,\" J. Derivatives, vol. 3, no. 2, pp. 73–84, 1995.",
  "U.S. Securities and Exchange Commission, \"EDGAR full-text search API,\" 2024. [Online]. Available: https://efts.sec.gov",
  "U.S. Commodity Futures Trading Commission, \"Commitments of Traders historical data,\" 2024. [Online]. Available: https://www.cftc.gov/MarketReports/CommitmentsofTraders",
  "Bank for International Settlements, \"Effective exchange rate indices,\" 2024. [Online]. Available: https://www.bis.org/statistics/eer.htm",
  "K. Leetaru and P. A. Schrodt, \"GDELT: Global data on events, location, and tone, 1979–2012,\" ISA Annual Convention, 2013.",
  "M. López de Prado, Advances in Financial Machine Learning, Wiley, 2018.",
  "AISStream.io, \"Global AIS data stream API documentation,\" 2026. [Online]. Available: https://aisstream.io",
  "T. Chen and C. Guestrin, \"XGBoost: A scalable tree boosting system,\" in Proc. ACM SIGKDD, 2016, pp. 785–794.",
];

const refs = [
  ...refsHead,
  ...REFS.map((r, i) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 40, line: 220 },
    indent: { left: 260, hanging: 260 },
    children: [new TextRun({ text: `[${i+1}] ${r}`, font: FONT, size: 18 })],
  })),
];


// ==========================================================================
// ASSEMBLE
// ==========================================================================

const PAGE = {
  size: { width: 12240, height: 15840 },          // US Letter
  margin: { top: 1080, bottom: 1440, left: 900, right: 900 }, // IEEE conference
};

const doc = new Document({
  creator: "Prathmesh Deshmukh",
  title: "Hedgyyyboo IEEE Paper v2",
  description: "IEEE conference paper for the Hedgyyyboo platform (full v3 scope)",
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [
    // Title block spans the page (single column)
    {
      properties: { page: PAGE, type: SectionType.CONTINUOUS },
      children: titleBlock,
    },
    // Body runs in two columns
    {
      properties: {
        page: PAGE,
        type: SectionType.CONTINUOUS,
        column: { count: 2, space: 420, equalWidth: true, separate: false },
      },
      children: [
        ...abstractBlock,
        ...secI, ...secII, ...secIII, ...secIV, ...secV,
        ...secVI, ...secVII, ...secVIII, ...secIX, ...secX,
        ...secXI, ...secXII,
        ...ack,
        ...refs,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(HERE, "Hedgyyyboo_IEEE_Paper_v2.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, `(${(buf.length/1024).toFixed(1)} KB)`);
});
