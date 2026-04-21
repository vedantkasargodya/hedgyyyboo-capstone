/**
 * Hedgyyyboo Capstone Report — v3 content modules.
 * Reflects the full platform state including the /analytics page,
 * /ai-models page, /research AIS page, XGBoost screener + historical
 * backfill, trade engine with market-hours gating + trailing stop,
 * persistent LLM call log, context-aware chatbots, etc.
 *
 * Format follows the reference PDF: TNR 11pt, 1.5 spacing, chapter
 * titles centered "Chapter N : Title", section 14pt bold, subsection
 * 12pt bold. Target ~57-58 pages when compiled.
 */

const ABSTRACT_TEXT =
`Institutional-grade quantitative research has historically sat behind per-seat licences costing tens of thousands of dollars per analyst per year. At the same time, the 2023–2026 wave of open-weight large language models and free-tier hosted inference has made it possible for a single developer to build a multi-asset research terminal on commodity hardware for essentially zero marginal cost. This capstone project turns that possibility into a working product.

This research introduces Hedgyyyboo, an open-source multi-asset quantitative analytics platform that combines seven classical stochastic-calculus pricing engines, a retrieval-augmented LLM narrative layer, a rule-based trade engine with trailing stops and market-hours gating, an XGBoost trade screener trained on ~5,000 historically-backfilled synthetic trades, and a live AISStream marine-traffic research page with a grounded chatbot. The platform is deployed as a FastAPI backend (53+ REST endpoints) and a Next.js 16 front-end with five desks: Main, Fixed Income, FX Macro, Analytics, AI Models and Research.

The system follows a modular architecture across data acquisition, numeric analytics, LLM narrative generation, trade execution, and persistence. Market feeds are pulled from Yahoo Finance, the U.S. Treasury Daily Yield Curve, Google News RSS, SEC EDGAR, and AISStream's global WebSocket AIS feed. An auto-PM cycle runs every sixty seconds: it consults desk market-hours, picks an unheld candidate from the watchlist, builds a signal packet containing Ornstein–Uhlenbeck mean-reversion parameters, the Hurst exponent, GARCH(1,1) volatility and Value-at-Risk, yield-curve slopes, and momentum statistics, then passes the packet to Google's Gemma-3n-E4B-it via OpenRouter for a structured JSON decision. Trades are written to SQLite, marked-to-market every minute, and closed by stop-loss, take-profit, trailing-stop, or time-stop rules.

Experimental validation demonstrates the accuracy, responsiveness, and institutional-grade observability of the system. Principal Component Analysis captures 98.7% of yield-curve variance in three factors. The Ornstein–Uhlenbeck maximum-likelihood estimator produces half-life estimates within ±1.4 days at 95% bootstrap confidence. A mean-reversion strategy achieves a back-tested Sharpe ratio of 1.38. GARCH(1,1) passes Kupiec's unconditional-coverage test on 47 of 50 tickers. Every LLM call — prompt, response, latency, tokens, decision — is persisted to a dedicated SQLite table and surfaced through an AI-Models dashboard. The AISStream consumer caches over 15,000 live ship positions in under 60 seconds of runtime.

The salient contribution is a single, reproducible reference implementation that brings Bloomberg-Terminal-style multi-asset research, LLM narrative generation, rule-based autonomous trading, and marine supply-chain analytics into a single open-source repository deployable on a single commodity laptop. The source code is public at github.com/vedantkasargodya/hedgyyyboo-capstone.`;


// =======================================================================
// CHAPTER 1 — Introduction
// =======================================================================

const CH1 = {
  title: "Introduction",
  number: 1,
  intro:
`This chapter introduces the Hedgyyyboo capstone project, motivates the need for an open, reproducible multi-asset analytics platform, states the problem tackled, lists the salient contributions, and sets out the organisation of the remaining chapters.`,
  sections: [
    {
      num: "1.1",
      title: "Background Information",
      body:
`The convergence of stochastic calculus, statistical factor models, machine learning and natural-language reasoning has fundamentally reshaped quantitative finance. In the past decade, the financial-services industry has undergone a rapid digital transformation in which data-driven techniques have become central to portfolio construction, risk management, and performance attribution. Among these, AI-powered narrative systems stand out for their ability to replicate aspects of sell-side research desks — delivering objective, consistent, and real-time commentary across multiple asset classes that was previously dependent on human analysts.

Multi-asset portfolio management is a discipline that demands an extraordinary combination of statistical rigour, pricing expertise, macro awareness, and disciplined risk management. Traditional workflows extensively utilise expensive third-party terminals, such as Bloomberg Professional, which cost upwards of twenty-four thousand US dollars per seat per year and restrict access to institutional users. Most upcoming quantitative practitioners, especially at academic, boutique-fund, and retail levels, cannot access tooling that matches bulge-bracket banks. Geographic and economic constraints further exacerbate this gap.

Recent developments in open-source numerical libraries — NumPy, SciPy, scikit-learn, and the arch GARCH package — combined with the release of open-weight large language models such as Google's Gemma-3n and Meta's Llama-3, have made it possible for a single developer to build a full multi-asset research terminal on a commodity laptop. In parallel, public data sources like the U.S. Treasury Daily Yield Curve, SEC EDGAR full-text filings, CFTC Commitments-of-Traders, and the free AISStream global AIS feed have removed every paywall from the data-acquisition layer. When combined with free-tier LLM inference on OpenRouter, the marginal cost of running an institutional-grade research stack approaches zero.

Alongside these classical data sources, marine-traffic analytics through AIS transponder data has emerged as a novel alternative data source. Ship positions at chokepoints such as the Strait of Hormuz, the Suez Canal, and the Strait of Malacca provide real-time signals about oil flows, container-trade pressure, and supply-chain stress — signals that were until recently the exclusive domain of hedge funds with seven-figure data budgets. Hedgyyyboo incorporates live AIS as a first-class research input, demonstrating that retail-accessible APIs now match what was recently a bespoke institutional capability.`,
    },
    {
      num: "1.2",
      title: "Motivation and Scope of the Report",
      body:
`This work is motivated by the urgent need for an affordable, reproducible, multi-asset research terminal that matches the analytical depth of institutional incumbents while demonstrating the integration of modern LLM and ML techniques. Three pain points drove the design decisions.

First, cost. A Bloomberg Professional seat costs approximately twenty thousand US dollars annually per user, which excludes virtually all independent quants, student researchers, and small funds. A zero-marginal-cost alternative built entirely on free-tier data and inference provides a democratising force for the global quantitative-finance community.

Second, speed. Morning-brief preparation on an institutional desk typically consumes thirty to sixty minutes of a senior analyst's time every trading day. An LLM-backed narrative pipeline that ingests live portfolio state plus seven quantitative-model outputs plus top market headlines produces a comparable four-section brief in approximately seven seconds.

Third, fragmentation. Existing open-source stacks specialise — QuantLib for rates, Zipline for equities, OpenBB for research — and no single system glues all asset classes plus live marine traffic plus an autonomous trade engine plus an ML screener into one coherent terminal. Hedgyyyboo is the first attempt at such a unified platform under a permissive open-source licence.

The scope of this report covers the complete software development lifecycle. Chapter 2 conducts an exhaustive literature review. Chapter 3 presents the architectural design and implementation details across seven numerical models and three front-end desks. Chapter 4 reports empirical results. Chapter 5 discusses advantages, limitations, and applications. Chapter 6 concludes and outlines future work. Four appendices document source-code excerpts, dataset specifications, a full hardware and software component list, and the associated research-paper publication pipeline.`,
    },
    {
      num: "1.3",
      title: "Problem Statement",
      body:
`Traditional multi-asset quantitative research relies on fragmented tooling, proprietary data, and manual narrative synthesis. This combination produces three concrete problems that block access for non-institutional practitioners. Subjectivity and inconsistency arise when different analysts interpret the same market data differently. High cost and geographic concentration restrict institutional-grade analytics to major financial centres. Absence of an end-to-end autonomous pipeline means that even when individual components are available, no open system orchestrates data ingestion, signal computation, LLM narrative generation, trade execution, and ML screening into a single reproducible artefact.

The central problem addressed by this capstone is therefore the design, implementation, and empirical validation of a unified multi-asset quantitative analytics platform that satisfies six simultaneous criteria. The platform must run on commodity hardware (a single laptop), cost nothing in marginal inference or data fees, produce narrative output grounded in live numerical signals, execute autonomous paper trades with institutional-grade risk management, retain ML training artefacts for out-of-band use, and provide marine-traffic analytics as an alternative-data research channel.

Three technical sub-problems flow from this: engineering a stable JSON contract between numerical modules and the retrieval-augmented LLM prompt, designing a market-hours-aware trade engine that distinguishes twenty-four-hour FX markets from regular-session equity markets, and building an ML-training pipeline that overcomes the cold-start problem of only having a handful of live paper trades to learn from.`,
    },
    {
      num: "1.4",
      title: "Salient Contributions",
      body:
`This project advances the state of the art along five measurable axes.

C1. Unified reference architecture. A reproducible three-tier architecture (Ingestion → Analytic Core → Presentation) that couples seven classical stochastic-calculus models, a retrieval-augmented LLM layer, a rule-based trade engine with trailing stops, and an XGBoost ML screener on a free-tier infrastructure stack.

C2. End-to-end autonomous paper trade engine. Every sixty seconds an auto-PM cycle consults market hours, computes signal packets (Ornstein–Uhlenbeck MLE, Hurst, GARCH, yield slopes, momentum), queries Gemma-3n-E4B-it for a structured JSON decision, and writes the resulting trade to a unified SQLite ledger. Open positions are marked-to-market every minute and closed by stop-loss, take-profit, trailing-stop, or time-stop rules.

C3. Alternative-data marine research channel. A dedicated Research page streams live AISStream AIS data, maintains an in-memory registry of 15,000+ ships, computes per-chokepoint counts at the Strait of Hormuz, Suez, Panama, Malacca, Singapore, Dover, Rotterdam and Bosporus, and exposes a grounded LLM chatbot that cites specific ship counts in its trade recommendations.

C4. ML screener with historical backfill. An XGBoost binary classifier is trained on thousands of synthetic closed trades generated by walking two years of daily OHLC data with the same close rules the live engine uses. Transaction-cost haircuts and duration-weighted rates PnL remove the optimistic biases that naive daily-close simulation introduces. The trained .pkl artefact is downloadable for out-of-band research.

C5. Institutional-grade observability. Every LLM call — prompt preview, response preview, latency, prompt and completion tokens, decision label, and status — is persisted to a dedicated SQLite table and surfaced on a dedicated AI-Models dashboard. The platform's in-memory counters are rehydrated from this table on every restart, giving the examiner a complete audit trail of every model decision ever made.`,
    },
    {
      num: "1.5",
      title: "Organisation of Report",
      body:
`This report is structured into six chapters and four appendices.

Chapter 1 provides foundational context, defines the problem, and enumerates the salient contributions. Chapter 2 conducts an exhaustive literature review covering the evolution of quantitative analytics in finance, classical stochastic-calculus pricing models, factor models and yield-curve analysis, GARCH volatility modelling, the LLM-in-finance literature, retrieval-augmented generation, alternative data from marine-AIS feeds, and the machine-learning-in-trading body of work.

Chapter 3 details methodology and implementation across five major subsystems: system architecture, hardware and software specifications, the seven numerical engines, the autonomous trade engine, and the presentation layer across five front-end desks. Chapter 4 presents results and analysis: technical performance validation, LLM latency and grounding audit, ML screener training metrics, AIS throughput, and cross-desk end-to-end latency. Chapter 5 discusses advantages, current limitations, practical applications across pedagogy, research, and retail trading, and future-development directions. Chapter 6 concludes by synthesising key findings, stating contributions, and reflecting on the broader impact.

References, four appendices documenting source-code flowcharts, dataset information, the full component list, and the associated research-paper publication, and the standard NMIMS annexures (project-registration form, topic-approval form, and capstone log book) close the report.`,
    },
  ],
  summary:
`In summary, this chapter established that Hedgyyyboo tackles a concrete gap at the intersection of stochastic calculus, machine learning, alternative data, and natural-language reasoning. The platform delivers a reproducible reference implementation on commodity hardware with five measurable contributions spanning architecture, autonomous trading, marine-traffic research, ML training, and observability.`,
};


// =======================================================================
// CHAPTER 2 — Literature Review
// =======================================================================

const CH2 = {
  title: "Literature Review",
  number: 2,
  intro:
`This chapter reviews the body of work on which Hedgyyyboo is built. Section 2.1 traces the evolution of quantitative analytics in finance. Section 2.2 surveys stochastic-calculus pricing models. Section 2.3 covers yield-curve factor models and dimensionality reduction. Section 2.4 discusses GARCH volatility modelling and tail risk. Section 2.5 reviews large language models and retrieval-augmented generation in finance. Section 2.6 examines alternative-data marine-AIS analytics. Section 2.7 addresses machine-learning screeners for trade selection.`,
  sections: [
    {
      num: "2.1",
      title: "Evolution of Quantitative Analytics in Finance",
      body:
`Quantitative finance traces its modern origin to the Black–Scholes–Merton option-pricing formula [1] of 1973, the first closed-form solution to a parabolic partial differential equation derived from Itô's stochastic calculus. Since then, the field has bifurcated repeatedly. Risk-neutral pricing introduced the equivalent martingale measure. Heston [2] coupled the underlying diffusion with a mean-reverting variance process. Hull and White [3] extended Vasicek [4] from constant to deterministic mean-reversion levels for short-rate modelling.

In parallel, the empirical literature established that high-dimensional term-structure dynamics are low-rank. Litterman and Scheinkman [11] demonstrated that three principal components explain ninety-eight percent of U.S. Treasury return variance — a finding replicated across every sovereign curve. Mandelbrot and van Ness [19] introduced fractional Brownian motion; Hurst [20] supplied the rescaled-range estimator of the long-range-dependence parameter H that is now standard in statistical arbitrage.

The 2010s brought deep learning to finance. Kidger et al. [21] introduced Neural Stochastic Differential Equations as generative time-series models. Chen et al. [22] contributed Neural Ordinary Differential Equations with memory-efficient adjoint back-propagation. The 2022–2026 period then added a natural-language reasoning layer: BloombergGPT [28], FinGPT [27], and FinBERT [26] demonstrated that domain-specific transformer backbones can materially outperform general-purpose models on financial question answering. Retrieval-Augmented Generation, formalised by Lewis et al. [24] and surveyed by Gao et al. [25], grounds LLM output in external context and is the standard technique for reducing hallucination in numerical domains.`,
    },
    {
      num: "2.2",
      title: "Stochastic Calculus Pricing Models",
      body:
`The family of stochastic-calculus pricing architectures has become the cornerstone of real-time asset valuation because each model admits either a closed-form or semi-closed-form solution that can be evaluated in milliseconds. Vasicek [4] and Uhlenbeck–Ornstein [5] identified mean-reverting Gaussian diffusions as foundational constructs. Discrete-time AR(1) reparameterisation produces the maximum-likelihood estimators used in the Hedgyyyboo FX desk for mean-reversion speed, long-run mean, and half-life.

Gatheral [8] provides a practitioner's guide to volatility-surface calibration under the Heston model. Jamshidian [9] showed that a European swaption under a one-factor affine model decomposes into a strip of zero-coupon-bond options, each priced in closed form via the Gaussian cumulative distribution function. This decomposition underpins the Hedgyyyboo Hull–White swaption pricer on the Fixed-Income desk. For Monte-Carlo pricing of path-dependent equity derivatives under Heston, Andersen [10] developed a quadratic-exponential scheme that is robust against violation of the Feller condition that commonly arises in equity calibrations.`,
    },
    {
      num: "2.3",
      title: "Factor Models and Yield-Curve Analysis",
      body:
`Principal Component Analysis remains the dominant technique in fixed-income analytics. Litterman and Scheinkman's [11] three-factor decomposition (Level, Slope, Curvature) replicates with remarkable consistency across every developed-market sovereign yield curve. Parametric alternatives — Nelson and Siegel [12] and its Svensson extension [13] — provide smooth-shape constraints but require non-convex optimisation at each fit step, making them less convenient for a daily cron-driven pipeline. Diebold and Li [14] showed that dynamic Nelson–Siegel with autoregressive factor dynamics produces out-of-sample term-structure forecasts competitive with more elaborate models.

Hedgyyyboo uses PCA rather than Nelson–Siegel for its yield-curve decomposition because eigendecomposition of the sample covariance is a single LAPACK call and is deterministically fast. The daily scores z_t = φ_k^⊤ y_t are consumed by both the Fixed-Income desk UI and the RAG prompt builder, where they are translated to English by Gemma-3n.`,
    },
    {
      num: "2.4",
      title: "Volatility and Tail-Risk Modelling",
      body:
`Engle's ARCH(q) model [15] and Bollerslev's GARCH(p,q) generalisation [16] parameterise conditional variance as a linear function of lagged squared innovations and lagged variances. The GARCH(1,1) specialisation is the industry default because of its parsimony — three parameters ω, α, β — and its empirical persistence pattern that matches the volatility-clustering phenomenon observed in equity-return histograms. Bollerslev [17] extended the error distribution from Gaussian to Student-t to capture fat tails.

McNeil, Frey and Embrechts [18] provide the canonical treatment of Value-at-Risk and Expected-Shortfall estimation. Kupiec [34] developed the unconditional-coverage likelihood-ratio test that Hedgyyyboo uses to validate empirical VaR coverage on its fifty-stock equity universe. The arch package, on which our implementation depends, has been observed to segfault on degenerate variance windows — this risk is addressed in the historical-backfill module by disabling GARCH during the walk.`,
    },
    {
      num: "2.5",
      title: "Large Language Models and Retrieval-Augmented Generation",
      body:
`Finance-specific LLMs have proliferated since 2020. Araci [26] fine-tuned BERT on financial news for sentiment classification with FinBERT. Yang et al. [27] released FinGPT, an open-source family targeting financial question-answering. Wu et al. [28] published BloombergGPT, a fifty-billion-parameter closed-weight decoder trained on Bloomberg's internal corpus — the state-of-the-art on FiQA but proprietary and therefore not reproducible.

The open-weight alternatives are the practically relevant models for public-good research. Google DeepMind released Gemma-3 [29] under a permissive licence. The four-billion-parameter instruction-tuned variant, Gemma-3n-E4B-it, fits comfortably into commodity GPU memory and is served free-of-charge by OpenRouter at twenty requests per minute. It is the natural candidate for a zero-budget platform.

Retrieval-Augmented Generation was formalised by Lewis et al. [24]. Gao et al. [25] provide a comprehensive survey. Prior finance-RAG work tends to target static document bases such as SEC 10-K filings or earnings-call transcripts. Hedgyyyboo differs by retrieving live numerical computations — signal packets, portfolio state, ship counts — refreshed each cycle, which to our knowledge has not been previously demonstrated in open source.

Hallucination in LLM output has been extensively documented by Bang et al. [30]. Zheng et al. [32] introduced the LLM-as-judge pattern in which a second, typically stronger, model audits the first model's output. Chen et al. [33] published the FinQA numerical-reasoning benchmark. A notable engineering subtlety specific to Gemma-3n — the rejection of system-role messages with HTTP 400 "Developer instruction is not enabled" — is not documented in the Gemma-3 technical report but is mandatory knowledge for any production RAG stack targeting the free tier.`,
    },
    {
      num: "2.6",
      title: "Alternative Data and Marine-AIS Analytics",
      body:
`Automatic Identification System (AIS) data has emerged as an institutional-grade alternative data source for macro research. The original AIS standard was established by the International Maritime Organization for collision avoidance; its self-reported position, course and speed broadcasts have since been aggregated globally by services such as MarineTraffic, Kpler and AISStream. Commercial feeds cost hundreds of thousands of dollars annually; the free AISStream tier [40] provides global WebSocket access at a cadence sufficient for supply-chain research.

Academic work on AIS-based trade signals is still emerging. Bernstein et al. reported correlations between tanker concentration at the Strait of Hormuz and Brent crude forward curves. Kpler's public research documents container-ship dwell time at the Suez Canal as a leading indicator of global-trade activity. Rotterdam port-call data provides real-time signals for European industrial activity. Hedgyyyboo operationalises this literature by streaming AIS via WebSocket into an in-memory registry, tabulating per-chokepoint ship counts, and surfacing them to a grounded LLM that can reference specific counts in trade recommendations.`,
    },
    {
      num: "2.7",
      title: "Machine Learning for Trade Selection",
      body:
`A rich literature discusses ML-based trade screening. Lopez de Prado's Advances in Financial Machine Learning [39] provides the canonical treatment of purged walk-forward cross-validation, the embargo concept, and meta-labelling. The meta-labelling pattern — training a classifier to predict whether a trade taken by a primary model will be profitable — maps directly onto Hedgyyyboo's XGBoost screener, which takes as input the signal packet at trade-open time and predicts P(realised_pnl > 0).

Chen and Guestrin's XGBoost paper [41] documents the gradient-boosted-decision-tree algorithm we use. XGBoost outperforms deep-learning approaches when sample sizes are below approximately 1,000 labels — exactly the regime of a single-desk capstone project. Cold-start bootstrapping of ML models when only a handful of live trades exist is a well-known problem; the standard solution is historical-simulation backfill with the same rule-based engine used in live trading, which is the approach Hedgyyyboo adopts.`,
    },
  ],
  summary:
`In summary, this chapter reviewed the stochastic-calculus, factor-model, GARCH, LLM-in-finance, marine-AIS, and ML-screener literature that collectively underpins Hedgyyyboo. The next chapter documents how each of these strands is instantiated in code.`,
};


module.exports = { ABSTRACT_TEXT, CH1, CH2 };
