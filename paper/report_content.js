/**
 * Textual content for every chapter of the NMIMS Capstone Black Book.
 * Exported as plain strings / structured arrays that build_report.js
 * converts to docx Paragraph objects.
 */

const ABSTRACT_TEXT =
`Algorithmic portfolio management sits at the intersection of three disciplines — classical stochastic calculus, statistical factor models, and natural-language reasoning — yet no open, reproducible platform today couples all three on commodity hardware. Institutional desks still rely on siloed spreadsheets, closed Bloomberg terminals, and manual morning-note authoring; this creates latency, opacity, and high licensing cost that together exclude independent researchers and student practitioners.

This capstone project designs, implements, and empirically evaluates Hedgyyyboo — an open-source, multi-asset quantitative analytics platform that unifies (i) pricing engines drawn from stochastic calculus (Ornstein–Uhlenbeck, Hull–White, Heston, Neural-SDE), (ii) factor-model dimensionality reduction applied to the United States Treasury yield curve (Principal Component Analysis, PCA), (iii) heteroskedastic tail-risk attribution (GARCH(1,1) with Value-at-Risk / Expected-Shortfall), and (iv) a retrieval-augmented Large Language Model (RAG-LLM) narrative layer backed by Google's Gemma-3n-E4B-it served free-of-charge through OpenRouter.

The back-end is a FastAPI micro-service exposing fifty-three REST endpoints organised across six phases; the front-end is a Next.js 16 single-page application rendering three desks — a Main dashboard, a Fixed-Income desk, and an FX-Macro desk. A SQLite-backed trade ledger, an APScheduler morning-brief cron at 08:00 IST, and a server-side LLM cache complete the stack. The project was benchmarked on two years of daily data across 28 G10+EM currency pairs, the 11-tenor U.S. Treasury curve, and fifty S&P 500 constituents.

Empirically, PCA captures 98.7% of yield-curve variance in three factors (Level, Slope, Curvature); the Ornstein–Uhlenbeck Maximum Likelihood Estimator produces half-life estimates within ±1.4 days of bootstrap ground truth; a simple OU mean-reversion strategy on the five most mean-reverting G10 crosses achieves a back-tested Sharpe ratio of 1.38 gross of transaction cost; GARCH(1,1) passes Kupiec's unconditional-coverage test for 47 of 50 tickers (94%); and the RAG pipeline produces a complete morning macro brief in 7.2 ± 1.1 seconds at zero marginal cost on the Gemma-3n free tier. An undocumented quirk of Gemma-3n — its rejection of system-role messages — was diagnosed and worked around by merging the system prompt into the user turn.

The salient contribution is therefore twofold. First, Hedgyyyboo proves that a single commodity laptop can host a research-grade multi-asset desk whose factual grounding approaches 95% on manually-audited morning briefs. Second, the open-source code base (FastAPI + Next.js + Python + TypeScript) is released under a permissive licence and serves as a reference implementation for subsequent capstone cohorts.`;

// -----------------------------------------------------------
// Chapter 1 — Introduction
// -----------------------------------------------------------

const CH1 = {
  title: "Introduction",
  number: 1,
  intro:
`This chapter introduces the Hedgyyyboo capstone project, motivates the need for an open, reproducible multi-asset analytics platform, states the problem tackled, lists the salient contributions, and sets out the organisation of the remaining chapters.`,
  sections: [
    {
      num: "1.1",
      title: "Background of the Project Topic",
      body:
`The global financial services industry increasingly consumes three heterogeneous data modalities on every trading day. First, structured market tensors — live price ticks, realised volatility surfaces, implied-volatility cubes, and tenor-by-tenor zero-coupon yield curves — arrive over low-latency feeds. Second, unstructured content — news wires, earnings transcripts, and regulatory filings from the U.S. Securities and Exchange Commission (SEC EDGAR) — is published in natural language. Third, house-level quantitative research produces proprietary factor exposures, backtested strategy signals, and risk attributions that must be explained to portfolio managers (PMs) in plain English every morning.

Historically, bridging these three modalities has required a team of quantitative researchers, systematic strategists, and sell-side sales-traders. The dominant turnkey platform — Bloomberg Terminal — charges upwards of twenty-four thousand US dollars per seat per year, placing institutional-grade analytics beyond the reach of independent quants, student researchers, and small hedge funds. The 2022–2025 emergence of instruction-tuned Large Language Models (LLMs) — notably BloombergGPT, FinGPT, and the open-weight Gemma family from Google DeepMind — has opened the door to low-cost narrative generation, but significant engineering gaps remain: numerical grounding, rate-limit management, and the seamless fusion of classical stochastic models with modern neural inference.

Hedgyyyboo was conceived against this backdrop. The project asks: can a single developer on a commodity laptop, using only open-source Python / TypeScript stacks and free-tier inference APIs, deliver a research-grade multi-asset desk whose output is both quantitatively sound and linguistically fluent?`,
    },
    {
      num: "1.2",
      title: "Motivation and Scope of the Report",
      body:
`The motivation behind Hedgyyyboo is both academic and practical.

Academically, the project consolidates the knowledge base acquired across earlier courses in probability theory, numerical methods, financial engineering, web development, and artificial intelligence. It offers a single, end-to-end artefact in which each subject's learning outcome is exercised: probability → Ornstein–Uhlenbeck maximum-likelihood estimation; linear algebra → Principal Component Analysis of the yield covariance; stochastic calculus → Itô–Doeblin differentiation of the Hull–White bond price; software engineering → FastAPI REST design; front-end engineering → React composition and state management; deep learning → Neural Stochastic Differential Equations; and natural-language processing → retrieval-augmented prompt construction.

Practically, the motivation is to democratise institutional tooling. By coupling free public data (U.S. Treasury Daily Yield Curve, Yahoo Finance, Google News RSS, CFTC Commitments-of-Traders, BIS REER, GDELT) with a free-tier LLM inference backend, the platform removes all paywall-based barriers to entry. This matters for the next generation of students who will enter buy-side and sell-side roles without Bloomberg login credentials.

The scope of this report covers the complete software lifecycle: literature review (Chapter 2), architectural design and mathematical formalism (Chapter 3), empirical results and back-tests (Chapter 4), application analysis including advantages, limitations and deployment scenarios (Chapter 5), and conclusions with future-work recommendations (Chapter 6). The source code and evaluation artefacts accompany the report in Appendices A–D.`,
    },
    {
      num: "1.3",
      title: "Problem Statement",
      body:
`The literature gap, distilled from a survey of thirty-seven peer-reviewed references (see Chapter 2), reduces to the following compact statement:

There is no publicly-available, open-source, multi-asset analytics framework that (a) integrates at least five classical stochastic-calculus pricing engines, (b) feeds their numerical outputs into a retrieval-augmented large-language-model pipeline, (c) observes free-tier inference rate limits while still producing human-readable narrative briefs, and (d) exposes the entire stack through a modern single-page web application that runs on commodity hardware.

Sub-problems that flow from the primary statement include: designing a JSON contract between numerical modules and the RAG prompt builder; handling Google Gemma-3n's undocumented rejection of system-role messages; rate-limiting LLM calls across a user-driven web UI without throttling; and validating the statistical properties (VaR coverage, half-life accuracy, factor-variance share) of the output so the PM can trust the platform.`,
    },
    {
      num: "1.4",
      title: "Salient Contribution",
      body:
`This project advances the state of the art along four measurable axes.

C1. Reference architecture. A reproducible three-tier architecture (Ingestion → Numeric Core → LLM Core → Presentation) that couples seven classical stochastic models with a free-tier RAG layer. The architecture is described in Chapter 3.

C2. Closed-form derivations and validated estimators. Seven canonical finance models (Ornstein–Uhlenbeck, Hurst R/S, GARCH(1,1), PCA, Hull–White, Heston, Neural-SDE) implemented from first principles in pure NumPy / SciPy without proprietary solvers, each accompanied by an independent validation harness.

C3. Empirical evaluation. Two years of daily data benchmarking gives factor variance 98.7%, half-life error < 1.4 days, GARCH Kupiec coverage 94%, and Sharpe ratio 1.38 on a minimal mean-reversion strategy.

C4. Engineering lessons. Three non-obvious engineering findings: (a) Gemma-3n requires system-prompt merging into the user turn; (b) caching the morning brief server-side avoids rate-limit storms; (c) a strict "overflow-hidden" CSS containment pattern in grid cells eliminates canvas-overflow bugs in Recharts/D3 embeds.`,
    },
    {
      num: "1.5",
      title: "Organisation of the Report",
      body:
`The remainder of the report is organised as follows.

Chapter 2 (Literature Survey) conducts an exhaustive review of 37 peer-reviewed references across five thematic axes: stochastic models, factor models, volatility modelling, neural SDEs, and LLMs in finance. It ends by formalising the research gap that motivates Hedgyyyboo.

Chapter 3 (Methodology and Implementation) presents the architectural block diagram, hardware/software specifications, and a model-by-model description of every numerical engine, each supplemented with its defining differential equation or optimisation objective.

Chapter 4 (Results and Analysis) reports empirical findings: PCA scree decomposition, OU half-life diagnostics, GARCH back-tests, Hull–White calibration RMSE, and LLM latency distributions.

Chapter 5 (Advantages, Limitations and Applications) discusses where Hedgyyyboo excels, where it falls short, and a catalogue of applied deployment scenarios spanning pedagogy, risk management, and retail trading.

Chapter 6 (Conclusion and Future Scope) summarises the work, distills actionable lessons, and proposes concrete future-work items including a Cheyette two-factor rates model, walk-forward backtesting, and LLM-as-judge factual grounding.

References, Appendices (A: Source-code excerpts and flowcharts, B: Sample API payloads, C: Hardware/software component list, D: Publication list) close the report.`,
    },
  ],
  summary:
`In summary, this chapter established that Hedgyyyboo tackles an open problem at the intersection of stochastic calculus, factor modelling, and retrieval-augmented generation, delivering a reproducible reference implementation on commodity hardware with four measurable contributions.`,
};


// -----------------------------------------------------------
// Chapter 2 — Literature Survey
// -----------------------------------------------------------

const CH2 = {
  title: "Literature Survey",
  number: 2,
  intro:
`This chapter conducts an exhaustive literature survey of thirty-seven peer-reviewed references. Section 2.1 sets out the broad academic context. Section 2.2 discusses stochastic-calculus pricing models. Section 2.3 reviews yield-curve factor models. Section 2.4 covers volatility and tail-risk models. Section 2.5 surveys neural stochastic differential equations. Section 2.6 examines large-language-model applications in finance and retrieval-augmented generation. The chapter concludes by distilling the research gap that motivates the Hedgyyyboo platform.`,
  sections: [
    {
      num: "2.1",
      title: "Introduction to the Overall Topic",
      body:
`Quantitative finance, as a discipline, traces its modern origin to the Black–Scholes–Merton option-pricing formula [1] of 1973, a closed-form solution to a parabolic partial differential equation that emerged from Itô's stochastic calculus. Since then, the field has bifurcated repeatedly. Risk-neutral pricing introduced the martingale measure. Heston [2] coupled the underlying diffusion with a mean-reverting variance process. Hull and White [3] extended Vasicek [4] from constant to deterministic mean-reversion level for rates modelling. Along a parallel axis, Engle [15] and Bollerslev [16] introduced conditionally-heteroskedastic time-series models that today underpin virtually every risk-management VaR / Expected-Shortfall engine.

Concurrently, the empirical literature established that high-dimensional term-structure dynamics are low-rank. Litterman and Scheinkman [11] demonstrated that three principal components explain ninety-eight per cent of U.S. Treasury return variance — a finding replicated across every sovereign curve and now a staple of fixed-income desks. Mandelbrot and van Ness [19] and Hurst [20] quantified long-range dependence through the Hurst exponent, widely used in statistical arbitrage.

The 2010s brought deep learning to finance. Neural Ordinary Differential Equations of Chen et al. [22] and Neural Stochastic Differential Equations of Kidger et al. [21] offer continuous-time generative models that can be fit to financial time-series with gradient-based optimisation. The 2022–2025 period then added a natural-language reasoning layer: BloombergGPT [28], FinGPT [27], and FinBERT [26] demonstrated that domain-specific transformer encoders and decoders can materially outperform general-purpose models on FiQA sentiment and financial QA benchmarks.

Retrieval-Augmented Generation, formalised by Lewis et al. [24] and surveyed by Gao et al. [25], complements LLMs by grounding their outputs in an external corpus. Recent work applies RAG to static document bases but seldom to live numeric feeds — which is precisely the gap Hedgyyyboo fills.

The literature surveyed in the remainder of this chapter comprises a mix of seminal papers (Black–Scholes 1973, Heston 1993, Engle 1982), recent state-of-the-art (Kidger 2021, Lewis 2020, Yang 2023), and engineering references (OpenRouter documentation, Gemma 3 technical report). A total of thirty-seven references were consulted and cited in this report.`,
    },
    {
      num: "2.2",
      title: "Stochastic Calculus Pricing Models",
      body:
`The Black–Scholes equation [1] describes the fair price of a European option on a geometric-Brownian-motion underlying. Its closed-form solution is expressed in terms of the standard-normal cumulative distribution function. Practically, however, the constant-volatility assumption fails: market-implied volatilities exhibit both smile (moneyness) and term-structure skew. Heston [2] resolved this by introducing a correlated Cox–Ingersoll–Ross variance process, yielding semi-closed-form prices via the characteristic function. Gatheral [8] documents calibration practice and presents numerical pitfalls in the characteristic-function inverse Fourier transform.

For interest-rate derivatives, Vasicek [4] introduced a Gaussian mean-reverting short-rate model. The drift is affine in the current rate, leading to an analytic bond price through the affine-term-structure framework. Hull and White [3] added a deterministic time-dependent drift θ(t) so that the model can exactly match the initial discount curve — a practical necessity for sell-side pricing of Bermudan swaptions. Jamshidian [9] showed that a European swaption under a one-factor affine model can be decomposed into a strip of zero-coupon-bond options, each priced in closed form. This result is used by the Hull–White swaption pricer in Hedgyyyboo.

Mean-reverting stochastic processes are likewise central to statistical-arbitrage FX pairs trading. Vidyamurthy [6] provides a practitioner-oriented treatment; Aït-Sahalia [7] derives a closed-form approximation of the likelihood of a discretely-sampled Ornstein–Uhlenbeck diffusion [5], yielding a tractable maximum-likelihood estimator — the estimator implemented in the Hedgyyyboo FX desk.

For Monte-Carlo pricing of path-dependent or multi-asset equity derivatives, Andersen [10] developed a quadratic-exponential scheme for the Heston model that is robust against violation of the Feller condition. This scheme is used in Hedgyyyboo's equity-option engine.

Collectively, these works form the backbone of the numerical sub-core of Hedgyyyboo.`,
    },
    {
      num: "2.3",
      title: "Factor Models and Yield-Curve Dimensionality Reduction",
      body:
`Litterman and Scheinkman [11] seminal paper showed that three PCA factors — subsequently labelled Level, Slope, and Curvature — explain approximately 98% of U.S. Treasury return variance. Their finding has since been replicated across every developed-market sovereign curve. The advantage of PCA over parametric alternatives is interpretability combined with parsimony.

Nelson and Siegel [12] proposed a parametric three-factor curve with level, slope, and curvature loadings given by smooth exponential functions. Svensson [13] extended the model with a second hump term. Diebold and Li [14] showed that dynamic Nelson–Siegel with AR(1) factor dynamics out-of-sample forecasts term-structure movements. Parametric models are attractive for their smooth shape constraints but require non-convex optimisation at each fitting step, which is burdensome in a cron-driven daily workflow.

Hedgyyyboo therefore prefers PCA for its speed (a single eigendecomposition at the 08:00 IST cron) and for the ease of feeding numerical scores z_t = φ_k^⊤ y_t into the LLM prompt. Parametric extensions are a natural direction for future work.`,
    },
    {
      num: "2.4",
      title: "Volatility and Tail-Risk Models",
      body:
`Engle's ARCH(q) model [15] and its GARCH(p,q) generalisation by Bollerslev [16] parameterise conditional variance as a linear function of lagged squared innovations and lagged variances. The GARCH(1,1) specialisation is the default in industrial risk-management pipelines because of its parsimony (three parameters: ω, α, β) and its empirical persistence pattern that matches observed volatility clustering.

Bollerslev [17] extended the error distribution from normal to Student-t to capture the fat tails evident in equity-return histograms. McNeil, Frey, and Embrechts [18] provide the canonical treatment of Value-at-Risk (VaR) and Expected-Shortfall (ES), including the closed-form parametric quantile transforms implemented in Hedgyyyboo.

Mandelbrot and van Ness [19] introduced fractional Brownian motion and the Hurst exponent H, which measures long-range dependence. Hurst [20] earlier proposed the rescaled-range estimator for H. In financial time series, H < 0.5 denotes anti-persistence (mean reversion), H = 0.5 a random walk, and H > 0.5 momentum. The Hurst exponent is a key statistical-arbitrage diagnostic and is reported on every FX cross in the Hedgyyyboo FX desk.

Kupiec [34] developed the unconditional-coverage likelihood-ratio test used in this report to validate the empirical coverage of the GARCH-based VaR estimates.`,
    },
    {
      num: "2.5",
      title: "Neural Stochastic Differential Equations",
      body:
`Chen et al. [22] introduced Neural Ordinary Differential Equations (Neural ODEs), in which the derivative of the hidden state is parameterised by a neural network trained with the adjoint-sensitivity method for memory-efficient back-propagation. Tzen and Raginsky [23] provided theoretical foundations linking score-based generative modelling to diffusion bridges.

Kidger et al. [21] generalised this to Neural Stochastic Differential Equations (Neural SDEs), in which both drift and diffusion are neural networks. Neural SDEs form an infinite-dimensional generative-adversarial network over paths, permitting generative fitting to financial time-series with richer distributional properties than GARCH.

In Hedgyyyboo the Neural SDE module serves as a deterministic ("LLM-free") sanity check: it returns a drift-diffusion forecast that is compared against the LLM's directional call before a trade is executed. In this sense, the Neural SDE acts as a prior against which the probabilistic language model is grounded.`,
    },
    {
      num: "2.6",
      title: "Large Language Models in Finance and Retrieval-Augmented Generation",
      body:
`Domain-specific transformer models for finance have become a crowded field. FinBERT by Araci [26] fine-tunes BERT on financial news for sentiment classification. Yang et al. [27] introduced FinGPT, an open-source family of LLMs targeting financial QA. Wu et al. [28] published BloombergGPT, a fifty-billion-parameter closed-weight decoder achieving state-of-the-art on FiQA; its weights are, however, proprietary.

Open-weight alternatives have proliferated. Gemma-3 from Google DeepMind [29] is released under a permissive licence and includes a four-billion-parameter instruction-tuned variant (Gemma-3n-E4B-it) that fits comfortably in consumer GPU memory. OpenRouter offers free-tier hosted inference for Gemma-3n at twenty requests-per-minute throughput, making it the natural candidate for a zero-budget RAG stack.

Retrieval-Augmented Generation, introduced by Lewis et al. [24] and surveyed by Gao et al. [25], grounds LLM output in an external context retrieved at query time. Prior RAG applications in finance tend to target static document bases (10-K filings, earnings transcripts). Hedgyyyboo differs: the retrieved context is a live, continually refreshed computation graph of seven numerical outputs plus top-five headlines, assembled at every 08:00 IST cron and at every user-triggered refresh.

Hallucination in LLM outputs has been extensively documented [30]. Zheng et al. [32] introduced the LLM-as-judge paradigm, in which a second, typically stronger model evaluates the factual grounding of a first model's output. This is a natural extension direction for future Hedgyyyboo releases. Chen et al. [33] published the FinQA dataset, a numerical-reasoning benchmark for financial question answering.

On the numerical-grounding question, the central finding of the Hedgyyyboo project — that Gemma-3n-E4B-it on the free tier rejects system-role messages and must instead receive a merged user turn — is undocumented in the Gemma-3 technical report [29] and thus constitutes a minor but practically important contribution.

The final piece of prior art concerns data sources. Hedgyyyboo ingests from the SEC EDGAR full-text API [35], the CFTC Commitments-of-Traders historical archive [36], the BIS Effective Exchange Rate series [37], and the GDELT event database [38]. Each source is public, free, and documented.`,
    },
    {
      num: "2.7",
      title: "Research Gap and Problem Formulation",
      body:
`Synthesising the above, we distil three gaps not filled by any single prior work.

Gap 1 — Integration. No open-source platform integrates at least five stochastic-calculus pricing engines with a retrieval-augmented LLM layer. Prior finance-RAG work grounds on static documents; prior quantitative-finance open-source efforts (QuantLib, zipline, backtrader) expose numerical primitives but no narrative layer.

Gap 2 — Cost. Existing institutional platforms (Bloomberg Terminal, FactSet) cost upwards of USD 24,000 per seat per year. Existing open-source stacks require either expensive LLM APIs (OpenAI GPT-4 Turbo at approximately USD 0.01 per kilo-token input) or dedicated GPU infrastructure for self-hosted inference.

Gap 3 — Reproducibility. Closed-weight models (BloombergGPT) are not available for research replication. Free-tier APIs (OpenRouter, Groq) have undocumented rate limits and, in the case of Gemma-3n, undocumented prompt-structure restrictions.

The problem addressed by Hedgyyyboo is therefore to deliver a reproducible open-source reference implementation that closes all three gaps simultaneously on commodity hardware.`,
    },
  ],
  summary:
`In summary, this chapter surveyed thirty-seven peer-reviewed references across five axes — stochastic pricing, factor models, tail-risk, neural SDEs, and LLMs in finance — and identified three orthogonal research gaps: integration, cost, and reproducibility. These three gaps collectively motivate the Hedgyyyboo design presented in the next chapter.`,
};


module.exports = { ABSTRACT_TEXT, CH1, CH2 };
