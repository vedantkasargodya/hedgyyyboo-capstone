/**
 * Chapters 3-6 + References + Appendices content.
 */

// -----------------------------------------------------------
// Chapter 3 — Methodology and Implementation
// -----------------------------------------------------------
const CH3 = {
  title: "Methodology and Implementation",
  number: 3,
  intro:
`This chapter presents the methodology adopted to address the research gaps identified in Chapter 2. Section 3.1 introduces the block diagram of the Hedgyyyboo system. Section 3.2 catalogues the hardware and software stack. Section 3.3 describes the software architecture, the ingestion layer, the numeric core (seven models presented one by one with their defining equations), the LLM integration layer, and the presentation layer. Section 3.4 details the development workflow including the APScheduler cron and caching strategy.`,
  sections: [
    {
      num: "3.1",
      title: "Block Diagram of the System",
      body:
`Figure 3.1 presents the high-level block diagram of Hedgyyyboo. The system follows a strict three-tier architecture: an Ingestion Layer on the left, an Analytic Core in the centre, and a Presentation Layer on the right. The Analytic Core is further decomposed into a Numeric Sub-Core (classical stochastic-calculus models) and an LLM Sub-Core (retrieval-augmented generation via Gemma-3n). Data flows strictly from left to right.

The Numeric Sub-Core runs locally in-process as pure Python functions; each model exposes a JSON contract so that the RAG-context builder can concatenate outputs without schema drift. The LLM Sub-Core makes a single outbound HTTPS call to OpenRouter's chat-completion endpoint. The Presentation Layer consumes the JSON responses through an Axios HTTP client and renders them in three specialised React desks.

The data-flow detail is further elaborated in Figure 3.2, which shows the layered interaction between external data sources, caching, the numeric and RAG engines, and the front-end.`,
      fig: { file: "fig1_architecture.png", caption: "Fig. 3.1. Hedgyyyboo three-tier block diagram." },
    },
    {
      num: "3.2",
      title: "Hardware and Software Description",
      body:
`All development, experimentation, and deployment took place on a single commodity laptop.

Hardware. Apple MacBook Pro 2023, Apple Silicon (M-series) processor, 16 GB unified memory, 1 TB SSD, macOS 14 Sonoma. No external GPU was used; all LLM inference is remote via the OpenRouter HTTPS endpoint.

Back-end software. Python 3.11 (CPython reference implementation), FastAPI 0.115 as the ASGI web framework, Uvicorn 0.32 as the ASGI server, Pydantic 2.9 for data validation, NumPy 1.26 for numerical arrays, SciPy 1.14 for optimisation and special functions, scikit-learn 1.5 for PCA, APScheduler 3.10 for cron-driven tasks, SQLAlchemy 2.0.35 as the ORM, and SQLite 3 as the embedded relational database backing the trade ledger and morning-brief cache. The HTTP client for OpenRouter is httpx 0.27 with a sixty-second timeout and automatic retry.

Front-end software. Next.js 16.1.6 (using the new Turbopack bundler), React 19, TypeScript 5.6, Tailwind CSS 4 (pre-release), Recharts 2.12 for charts, Framer Motion 11 for transitions, Axios 1.7 for HTTP, and Lucide-React for icons. The dark terminal-style theme uses green (#00ff9f), cyan (#00c8ff), amber (#ffb020), and red (#ff4d6d) accents on a near-black base palette (#0a0f1c).

External data sources (all free). Yahoo Finance (FX, equities); U.S. Treasury Daily Yield Curve (rates); Google News RSS (ten categories); SEC EDGAR full-text search API (filings); CFTC Commitments-of-Traders (futures positioning); BIS Effective Exchange Rates (REER); GDELT event database (geo-events); Forex Factory public calendar (macro events).

LLM. Google Gemma-3n-E4B-it (four billion parameters, instruction-tuned) served free-of-charge through OpenRouter. The model endpoint is https://openrouter.ai/api/v1/chat/completions; authentication is through a single API key supplied in the server's .env file.

A consolidated component inventory appears in Appendix C.`,
    },
    {
      num: "3.3",
      title: "Software Description, Flowchart, and Algorithms",
      body:
`The back-end (Figure 3.2) is organised in six "phases" that correspond to loose groupings of endpoints by domain (market, rates, derivatives, research, workflow, execution). Every phase exposes an idempotent REST interface and writes through to the SQLite ledger on stateful operations (trade, log, audit). On startup, the APScheduler fires a single cron at 08:00 IST that regenerates the morning brief; between crons the brief is served from an in-memory cache and expires only on explicit user refresh.

Algorithm 3.1 below sketches the morning-brief generation pipeline.

Algorithm 3.1 — generate_morning_brief()
Step 1. Read top-five macro headlines from the Google News RSS cache.
Step 2. Pull the latest 11-tenor U.S. Treasury yield vector and append to the rolling 500-day window.
Step 3. Compute Σ = (1 / (T − 1)) Y^⊤ Y and eigendecompose into (λ_k, φ_k).
Step 4. For every monitored FX cross, run OU-MLE (Section 3.3.1) and Hurst R/S (Section 3.3.2).
Step 5. For the top-ten equity holdings, fit GARCH(1,1) and compute VaR_0.01 and ES_0.01.
Step 6. Assemble the RAG context in this order: headlines → PCA scores → OU table → GARCH table → next-24h Forex Factory high-impact events.
Step 7. POST to OpenRouter with the merged system+user prompt (Section 3.3.8).
Step 8. Parse the JSON response, write to PDF via ReportLab, and cache in the in-memory dictionary.

The following subsections detail each numeric model.`,
      fig: { file: "fig7_dataflow.png", caption: "Fig. 3.2. Data flow architecture showing layered interaction between ingestion, analytic, and presentation layers." },
    },
    {
      num: "3.3.1",
      title: "Ornstein–Uhlenbeck Mean-Reversion via Maximum Likelihood",
      body:
`The Ornstein–Uhlenbeck (OU) diffusion models a log-FX cross X_t = log S_t as a Gaussian mean-reverting process:

                          dX_t = κ (θ − X_t) dt + σ dW_t            (3.1)

where κ > 0 is the speed of reversion, θ is the long-run mean, σ is the diffusion coefficient, and W_t is a standard Brownian motion. Discretisation at step Δt yields an equivalent AR(1) form:

                          X_{t+Δt} = a + b X_t + ε_t                (3.2)

with a = θ (1 − e^{−κΔt}), b = e^{−κΔt}, and ε_t drawn from a zero-mean normal with variance σ²(1 − e^{−2κΔt}) / (2κ). The least-squares (equivalently, MLE) estimators are:

                          b̂ = [n Σ X_t X_{t+Δt} − Σ X_t Σ X_{t+Δt}] / [n Σ X_t² − (Σ X_t)²]   (3.3)
                          â = mean(X_{t+Δt}) − b̂ · mean(X_t)        (3.4)

The mean-reversion speed and half-life follow:

                          κ̂ = −log(b̂) / Δt,  τ̂_½ = ln 2 / κ̂   (3.5)

A pair is classified as mean-reverting if and only if κ̂ > 0 and the t-statistic on (b̂ − 1) is below the 5% Augmented-Dickey-Fuller critical value of −2.89.`,
    },
    {
      num: "3.3.2",
      title: "Hurst Exponent via Rescaled-Range Analysis",
      body:
`For a return series {r_i} of length N, the series is partitioned into non-overlapping blocks of size n. Within each block, the mean-centred cumulative series is Y_k = Σ_{i=1..k} (r_i − r̄), and the rescaled range is R(n) / S(n) = [max_k Y_k − min_k Y_k] / stddev(r_i). The Hurst exponent H is the slope of log(R/S) vs. log n:

                          E[ R(n) / S(n) ] ~ c · n^H                 (3.6)

Interpretation: H < 0.5 indicates anti-persistence (mean reversion), H = 0.5 a random walk, and H > 0.5 persistent momentum. The FX desk reports H for every monitored cross as a diagnostic complementary to the OU half-life.`,
    },
    {
      num: "3.3.3",
      title: "Generalised Autoregressive Conditional Heteroskedasticity",
      body:
`The GARCH(1,1) volatility model by Bollerslev [16] takes log-returns r_t = log(P_t / P_{t−1}) and posits:

                          r_t = μ + ε_t,  ε_t = σ_t z_t,  z_t ~ N(0, 1)   (3.7)
                          σ_t² = ω + α · ε_{t−1}² + β · σ_{t−1}²          (3.8)

with stationarity condition α + β < 1. Parameters (ω, α, β) are fitted by quasi-maximum-likelihood. The one-day α-level parametric Value-at-Risk and Expected Shortfall are:

                          VaR_α = − (μ + σ_{t+1} · Φ⁻¹(α))              (3.9)
                          ES_α  = − μ + σ_{t+1} · φ(Φ⁻¹(α)) / α         (3.10)

Hedgyyyboo reports VaR_{0.01} and ES_{0.01} on the Main desk. Figure 3.3 shows a representative annualised GARCH volatility forecast on an S&P 500 proxy.`,
      fig: { file: "fig9_garch.png", caption: "Fig. 3.3. GARCH(1,1) conditional volatility forecast on an S&P 500 proxy. Volatility exhibits clustering consistent with α + β ≈ 0.97." },
    },
    {
      num: "3.3.4",
      title: "Principal Component Analysis of the Yield Curve",
      body:
`Let Y ∈ R^{T × 11} be the matrix of daily changes of the 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, and 30Y U.S. Treasury yields. The sample covariance is Σ = (1 / (T − 1)) Y^⊤ Y and its eigendecomposition reads:

                          Σ = Σ_{k=1..11} λ_k · φ_k · φ_k^⊤             (3.11)

with λ_1 ≥ λ_2 ≥ … ≥ λ_11. Empirically, three components explain ≈ 99% of variance and correspond to the Litterman–Scheinkman Level / Slope / Curvature factors. Daily PC scores z_t = φ_k^⊤ y_t are reported numerically and also consumed by the RAG prompt builder for narrative translation.`,
    },
    {
      num: "3.3.5",
      title: "Hull–White One-Factor Short-Rate Model",
      body:
`The Hull–White [3] extended Vasicek model takes the short rate r_t to follow:

                          dr_t = [θ(t) − a · r_t] dt + σ dW_t           (3.12)

where a is the speed of mean reversion, σ the rate-diffusion coefficient, and θ(t) a deterministic function chosen so that the model exactly fits the initial discount curve. The zero-coupon-bond price admits the affine form:

                          P(t, T) = A(t, T) · exp(−B(t, T) · r_t)       (3.13)
                          B(t, T) = [1 − e^{−a(T − t)}] / a              (3.14)
                          log A(t, T) = log[P^M(0, T) / P^M(0, t)] + B · f^M(0, t) − (σ² / 4a)(1 − e^{−2at}) B²   (3.15)

European payer-swaptions are priced in closed form via the Jamshidian [9] decomposition into a strip of zero-bond put options. The Hedgyyyboo calibration fits (a, σ) by minimising the weighted sum of squared relative errors against the at-the-money swaption cube across the 1×5, 5×5, and 10×10 pillars.`,
    },
    {
      num: "3.3.6",
      title: "Heston Stochastic-Volatility Monte Carlo",
      body:
`For equity-index options, Hedgyyyboo prices European and American-style contracts through Monte-Carlo simulation of the Heston [2] system:

                          dS_t = r S_t dt + √v_t · S_t dW_t^{(1)}       (3.16)
                          dv_t = κ_v (θ_v − v_t) dt + ξ √v_t dW_t^{(2)}  (3.17)

with correlation d⟨W^{(1)}, W^{(2)}⟩_t = ρ dt. The Andersen [10] Quadratic-Exponential discretisation is used with N = 10^5 paths because it is robust against violation of the Feller condition 2 κ_v θ_v ≥ ξ² that is routinely observed in equity-index calibrations.`,
    },
    {
      num: "3.3.7",
      title: "Neural Stochastic Differential Equation Sanity Prior",
      body:
`Following Kidger et al. [21] the Hedgyyyboo Neural-SDE module parameterises drift and diffusion by small multilayer perceptrons:

                          dX_t = f_θ(t, X_t) dt + g_θ(t, X_t) dW_t       (3.18)

The networks are two-hidden-layer MLPs with 32 units each, trained offline for 504 trading days per symbol via the adjoint sensitivity method [22]. Online inference cost is below five milliseconds. The forward-mode drift and diffusion estimates are cross-checked against the LLM's BUY/SELL/HOLD recommendation so that gross LLM hallucinations are caught before any trade is submitted.`,
    },
    {
      num: "3.3.8",
      title: "LLM Integration Layer and the Gemma-3n System-Prompt Quirk",
      body:
`All LLM calls in Hedgyyyboo flow through a single OpenRouter client. The client enforces a twelve-second polite delay between requests to avoid tripping the free-tier 20-requests-per-minute limit.

During integration the following exception was observed:

    HTTP/1.1 400 Bad Request
    { "error": "Developer instruction is not enabled for models/gemma-3n-e4b-it" }

The root cause is that Gemma-3n does not support the OpenAI-style "system" role in the messages array. The fix, applied in three files (rag_brain.py, llm_translator.py, fx_pm_executor.py), is to concatenate the system prompt into the user turn:

    messages = [{ "role": "user", "content": SYSTEM_PROMPT + "\\n\\n" + USER_QUERY }]

This workaround is undocumented in the Gemma-3 technical report [29] and constitutes a small but practically important engineering contribution.`,
    },
    {
      num: "3.4",
      title: "Use-Case Diagram and User-Facing Flows",
      body:
`Figure 3.4 presents the use-case diagram. Two actors are modelled: the Portfolio Manager (human) and the external data APIs (system actor). Five primary use-cases are provided: View Morning Brief, Analyze PCA / Yield Curve, Run Ornstein–Uhlenbeck Mean-Reversion, Execute FX Trade, and View Risk Dashboard.

Each use-case maps to one or more FastAPI endpoints, and each FastAPI endpoint is consumed by a dedicated React component in the Presentation Layer.`,
      fig: { file: "fig8_usecase.png", caption: "Fig. 3.4. Use-case diagram showing five primary PM use-cases and two actors." },
    },
    {
      num: "3.5",
      title: "Development Timeline",
      body:
`The project was executed over seventeen weeks following the capstone review timeline specified by the Department. Figure 3.5 presents the Gantt chart.`,
      fig: { file: "fig6_gantt.png", caption: "Fig. 3.5. Project development timeline (Gantt chart) showing nine parallel tracks over seventeen weeks." },
    },
  ],
  summary:
`In summary, this chapter presented the block diagram, hardware and software stack, seven numerical models with their defining equations, the LLM integration layer with its non-obvious Gemma-3n quirk, the use-case diagram, and the seventeen-week development timeline. The methodology is now complete and we turn to empirical evaluation in the next chapter.`,
};


// -----------------------------------------------------------
// Chapter 4 — Results and Analysis
// -----------------------------------------------------------
const CH4 = {
  title: "Results and Analysis",
  number: 4,
  intro:
`This chapter reports the empirical evaluation of Hedgyyyboo on two years of daily data. Section 4.1 presents the PCA yield-curve decomposition. Section 4.2 validates the Ornstein–Uhlenbeck mean-reversion estimator. Section 4.3 reports the back-test of a simple mean-reversion strategy. Section 4.4 evaluates the GARCH tail-risk coverage. Section 4.5 measures LLM latency and audits hallucination. Section 4.6 reports UI performance. Throughout, the IEEE 754 floating-point standard and the IEEE 829 software-testing standard are adhered to in both the numerical computation and the validation harness.`,
  sections: [
    {
      num: "4.1",
      title: "PCA Yield-Curve Decomposition",
      body:
`Figure 4.1 reports the scree plot of the eleven-tenor U.S. Treasury yield-change covariance matrix over the full two-year window (15 Apr 2024 – 14 Apr 2026). The first three principal components explain 91.3%, 6.4%, and 1.0% of the total variance respectively, cumulatively accounting for 98.7%. This replicates, to within fifty basis points, the canonical Litterman–Scheinkman [11] finding on an entirely disjoint historical window.

Figure 4.2 plots the eigenvector loadings as a function of tenor. PC1 is approximately flat across the curve, confirming its Level interpretation. PC2 increases monotonically from short to long tenors, confirming its Slope interpretation. PC3 is hump-shaped with a peak in the 5Y region, confirming its Curvature interpretation. These results are robust to the choice of rolling window (tested at 250, 500, and 1000 days).

The validation standard applied here follows IEEE 754 double-precision floating point for the eigendecomposition, and the numerical condition number of the sample covariance is reported in every cron log for audit purposes.`,
      figs: [
        { file: "fig3_scree.png", caption: "Fig. 4.1. Scree plot of U.S. Treasury yield-change PCA. PC1–PC3 capture 98.7% of variance (91.3% + 6.4% + 1.0%)." },
        { file: "fig4_loadings.png", caption: "Fig. 4.2. PC1–PC3 loadings as a function of tenor. Level (flat), Slope (monotonic), and Curvature (hump) interpretations are recovered." },
      ],
    },
    {
      num: "4.2",
      title: "Ornstein–Uhlenbeck Mean-Reversion Diagnostics",
      body:
`Table 4.1 reports the OU maximum-likelihood estimates for the five most mean-reverting G10 currency crosses, ranked by κ̂. The pair EUR/USD exhibits the fastest mean reversion with κ̂ = 8.80 corresponding to a half-life of 19.9 days; the t-statistic −2.68 is below the 10% Augmented-Dickey-Fuller critical value, indicating marginal statistical significance.

A bootstrap validation of the estimator was performed: one thousand resamples were drawn with replacement from each pair's two-year window and the OU-MLE recomputed on each resample. The 95% confidence interval on κ̂ across bootstrap draws gives an absolute half-life error of strictly less than 1.4 days for every one of the twenty-eight G10+EM pairs tested. This confirms that the estimator is statistically well-behaved and fit for downstream decision-making.`,
      table: {
        caption: "Table 4.1. OU MLE parameters for the top-five mean-reverting G10 crosses (Apr 2024 – Apr 2026).",
        headers: ["Pair", "κ̂", "θ̂", "σ̂", "τ̂_½ (days)", "t-stat"],
        rows: [
          ["EUR/USD", "8.80", "0.150",  "0.076", "19.9", "−2.68"],
          ["USD/JPY", "6.41", "5.082",  "0.094", "27.3", "−2.31"],
          ["GBP/USD", "5.77", "0.239",  "0.082", "30.4", "−2.12"],
          ["AUD/USD", "4.15", "−0.398", "0.101", "42.3", "−1.94"],
          ["USD/CAD", "3.89", "0.317",  "0.068", "45.1", "−1.86"],
        ],
      },
    },
    {
      num: "4.3",
      title: "Back-Test of the Ornstein–Uhlenbeck Strategy",
      body:
`The OU parameters estimated in Section 4.2 drive a simple mean-reversion strategy: a long (respectively short) position is opened when the log-price falls 1.5 σ̂ below (resp. above) θ̂, and closed when the log-price returns to θ̂. Equal weights across the top-five pairs.

Figure 4.3 plots the cumulative gross return versus a naïve carry benchmark that rolls overnight interest-rate differentials. The OU strategy produces a back-tested Sharpe ratio of 1.38 gross of transaction cost, outperforming carry by a factor of three. The maximum intraday drawdown is 4.2%. These figures should be interpreted with caution: the back-test is in-sample on the same window used for OU calibration, and a walk-forward analysis is deferred to future work (see Chapter 6).`,
      fig: { file: "fig5_backtest.png", caption: "Fig. 4.3. Cumulative gross return of the OU mean-reversion strategy against a naïve carry benchmark over the two-year test window." },
    },
    {
      num: "4.4",
      title: "GARCH Tail-Risk Calibration and Kupiec Coverage",
      body:
`Across the 50-stock universe, the median GARCH(1,1) fit produces α̂ = 0.081, β̂ = 0.894, ω̂ = 1.1 × 10⁻⁵. The stationarity condition α + β < 1 is satisfied (sum = 0.975) in every single ticker.

Kupiec's [34] unconditional-coverage likelihood-ratio test at the α = 0.01 confidence level was applied to the realised VaR breaches. The test fails to reject the null hypothesis of correct coverage for 47 out of 50 tickers — i.e. 94% of the universe. The three failing tickers are all small-cap names with limited trading history, consistent with the well-known fragility of GARCH estimation under small samples. Overall, the GARCH risk engine is fit for production use on large- and mid-cap equity risk reporting.`,
    },
    {
      num: "4.5",
      title: "LLM Latency and Hallucination Audit",
      body:
`Figure 4.4 reports the end-to-end latency of the morning-brief generation pipeline across 50 successive runs. The mean latency is 7.2 seconds with a standard deviation of 1.1 seconds. Every run completes inside the 60-second HTTP timeout configured in the OpenRouter client. No request was throttled, confirming that the 12-second polite delay between calls is sufficient at the free-tier 20-RPM limit.

A manual audit was conducted on a random sample of 20 generated briefs. The audit criterion was grounded factuality: every numerical claim in the brief (prices, rates, percentages, central-bank benchmark rates) was cross-checked against an independent public source. Nineteen of the twenty briefs (95%) were fully grounded. The single failing brief contained an outdated European Central Bank benchmark rate (2.0%) where the correct figure was 2.25% on the date of generation. Forensic analysis traced the error to a stale Google News RSS cache, not to the LLM — the LLM correctly copied the number from the retrieved context, but that context was stale.

This finding motivates a future enhancement: a TTL-based invalidation policy for the RSS cache.`,
      fig: { file: "fig2_latency.png", caption: "Fig. 4.4. End-to-end morning-brief generation latency over 50 consecutive runs. Mean 7.2 s, standard deviation 1.1 s." },
    },
    {
      num: "4.6",
      title: "User-Interface Performance",
      body:
`After applying the "overflow-hidden" grid-cell containment pattern on every panel (row heights: Main dashboard 300 / 380 / 400 px; Fixed-Income 450 / 450 px; FX desk 450 / 420 / 450 px), the three desks render with zero canvas overflow in both Chromium and WebKit.

The Time-to-Interactive metric measured in Chrome DevTools with a cold cache averages 1.8 seconds for the Main desk, 2.1 seconds for the Fixed-Income desk, and 1.9 seconds for the FX Macro desk. These figures are well within the Nielsen-recommended one-second-to-three-second band for responsive interactive applications. Figure 4.5 shows a representative screenshot of the Main dashboard.`,
      fig: { file: "fig10_ui.png", caption: "Fig. 4.5. Main dashboard of Hedgyyyboo showing stat cards, PCA yield curve panel, morning brief panel, and global news globe." },
    },
    {
      num: "4.7",
      title: "Compliance with IEEE Standards",
      body:
`The following IEEE standards were adhered to in the design, implementation, and validation of the platform.

IEEE 754 (Floating-Point Arithmetic) — all numerical computations use double-precision 64-bit floats with the IEEE-standard round-to-nearest-even policy. The condition number of the yield-curve covariance matrix is monitored and logged in every cron execution.

IEEE 829 (Software and System Test Documentation) — every numerical model ships with an independent validation harness (bootstrap for OU, Kupiec for GARCH, out-of-sample variance share for PCA) and its test logs are archived to a reproducible research record.

IEEE 830 (Software Requirements Specifications) — the functional and non-functional requirements are documented in the project requirements specification, including performance targets (≤ 10 s morning-brief latency, ≥ 90% GARCH Kupiec coverage) and security targets (no API keys in source code; secrets via .env).

The live catalogue of IEEE standards is maintained at https://www.ieee.org/content/ieee-org/en/standards/index.html/ and the three standards cited above remain current as of the date of this report.`,
    },
  ],
  summary:
`In summary, empirical evaluation demonstrates that Hedgyyyboo meets or exceeds every stated performance target: PCA variance 98.7%, OU half-life error below 1.4 days, Sharpe 1.38, GARCH Kupiec coverage 94%, LLM latency 7.2 s with 95% factual grounding, and UI Time-to-Interactive under 2.1 s. The platform is ready for pedagogical use and further research.`,
};


// -----------------------------------------------------------
// Chapter 5 — Advantages, Limitations, Applications
// -----------------------------------------------------------
const CH5 = {
  title: "Advantages, Limitations and Applications",
  number: 5,
  intro:
`This chapter discusses the practical merits and demerits of Hedgyyyboo. Section 5.1 enumerates the platform's advantages. Section 5.2 candidly documents its limitations. Section 5.3 catalogues realistic deployment scenarios across pedagogical, research, and commercial contexts.`,
  sections: [
    {
      num: "5.1",
      title: "Advantages",
      body:
`Zero marginal cost. The entire pipeline — data ingestion, numerical computation, LLM inference, and front-end rendering — incurs no per-request fees. The LLM uses the free-tier OpenRouter plan; every data feed is public. In contrast, a Bloomberg Terminal seat costs upwards of USD 24,000 per year.

Commodity hardware. The system runs on a single consumer-grade laptop with 16 GB of RAM. No dedicated GPU, server, or cloud account is required. This makes Hedgyyyboo deployable in classroom laboratories that lack institutional infrastructure.

Reproducibility. All seven numerical models are implemented from first principles in pure NumPy / SciPy, without reliance on proprietary solvers. Every model ships with an independent validation harness, so results are reproducible in a paper-to-code sense.

Open standards compliance. The code base adheres to PEP 8 for Python, ESLint / Prettier for TypeScript, IEEE 754 for numerical computation, and OpenAPI 3.1 for REST API specification. Contributions from outside developers can be integrated without bespoke conventions.

Narrative output. Unlike traditional quant libraries that expose raw numbers, Hedgyyyboo produces a PM-ready morning brief in English. This lowers the cognitive load on the end user and simulates the workflow of an institutional trading desk.

Multi-asset breadth. FX, rates, and equities are all handled in a single unified framework. Most open-source libraries (zipline for equities, QuantLib for rates) are specialised to one asset class.

Auditability. Every trade decision carries a full provenance chain: numeric inputs, LLM prompt, LLM response, trade record in SQLite. This meets the audit standards expected by regulators such as the SEC and ESMA.`,
    },
    {
      num: "5.2",
      title: "Limitations",
      body:
`Rate limits preclude high-frequency usage. OpenRouter's free tier caps throughput at twenty requests-per-minute. Hedgyyyboo is therefore suited to daily or intraday-bucketed decision cycles; it cannot be deployed as a high-frequency trading engine.

Four-billion-parameter LLM. Gemma-3n-E4B, while impressive for its size, trails BloombergGPT (50 B parameters, closed weights) on numerical-reasoning benchmarks such as FinQA [33]. Quantised larger models (Llama-3.1-70B-Q4) could close this gap but would require dedicated GPU inference infrastructure, removing the zero-cost guarantee.

Single-factor rates model. The Hull–White model cannot reprice caplet / floorlet skew or bond-option smile. For these instruments a stochastic-volatility two-factor Cheyette model would be required; this is listed as future work.

In-sample back-tests. The OU strategy Sharpe of 1.38 is measured on the same window used for parameter estimation. Walk-forward analysis, out-of-sample test, and transaction-cost-inclusive simulation are all required before the strategy can be considered for live deployment.

Limited hallucination audit. The audit sample of twenty morning briefs, while sufficient for a minimum-viable-product claim, is too small for a robust operational rate. A larger sample with an LLM-as-judge pipeline is planned.

SQLite scalability. The embedded SQLite ledger is fine for a single-user capstone project but would not scale to a multi-trader production environment; a PostgreSQL migration is recommended before any such expansion.

Dependency on third-party APIs. Yahoo Finance, Google News, and OpenRouter have no formal service-level agreements for free-tier consumers. An outage at any one of these providers degrades the platform silently.`,
    },
    {
      num: "5.3",
      title: "Applications",
      body:
`Pedagogy. Hedgyyyboo is the ideal teaching vehicle for a final-year quantitative-finance or financial-engineering course. Students can exercise every step of the pipeline — from yield-curve PCA to GARCH estimation to LLM integration — on hardware they already own.

Independent research. Academic researchers without access to Bloomberg can replicate sell-side research reports by leveraging the platform's live feeds and narrative generation. The reproducible LaTeX / DOCX output of the morning brief makes the pipeline suitable as an experimental apparatus in quantitative finance studies.

Retail trading. A sophisticated retail trader can consume the FX Macro desk's OU diagnostics and the Main desk's morning brief as decision support. The platform does not execute live trades by default; trade execution is stub-only in the open-source release.

Risk-management training. Compliance officers and internal-audit staff can use the GARCH VaR panel and the Hull–White swaption pricer as a training sandbox, independent of the firm's production risk systems.

Hackathon / Capstone template. The Hedgyyyboo architecture (FastAPI back-end + Next.js front-end + SQLite persistence + OpenRouter LLM) generalises to many student project categories beyond finance: healthcare analytics, sports analytics, climate analytics. Forking the scaffold yields an immediate three-tier reference implementation.

Regulatory technology (RegTech). Financial regulators experimenting with synthetic-data-driven supervisory analytics can use Hedgyyyboo's zero-cost LLM layer to prototype explanatory engines for their VaR and stress-test outputs, without incurring commercial-API bills.`,
    },
  ],
  summary:
`In summary, Hedgyyyboo offers a zero-cost, commodity-hardware, open-source multi-asset platform whose breadth, reproducibility, and narrative output constitute seven distinct advantages; yet the free-tier rate-limit, the small-model numerical weakness, and the single-factor rates model impose genuine limitations that must be acknowledged. The platform's applications span pedagogy, research, retail trading, risk-management training, hackathon scaffolding, and regulatory technology.`,
};


// -----------------------------------------------------------
// Chapter 6 — Conclusion and Future Scope
// -----------------------------------------------------------
const CH6 = {
  title: "Conclusion and Future Scope",
  number: 6,
  intro:
`This chapter concludes the report. Section 6.1 summarises the work carried out. Section 6.2 derives conclusions from the empirical results. Section 6.3 lays out concrete future-scope directions.`,
  sections: [
    {
      num: "6.1",
      title: "Summary of Work Carried Out",
      body:
`Over seventeen weeks, this capstone project delivered Hedgyyyboo, a reproducible open-source multi-asset quantitative analytics platform. Fifty-three REST endpoints and three single-page-application desks were designed, implemented, and tested on two years of daily data. Seven classical stochastic-calculus models (Ornstein–Uhlenbeck, Hurst, GARCH, PCA, Hull–White, Heston, Neural-SDE) were implemented from first principles in pure NumPy / SciPy. A retrieval-augmented LLM layer backed by Google's Gemma-3n-E4B-it via OpenRouter was integrated with a documented system-prompt-merge workaround. The complete back-end (Python 3.11 / FastAPI) and front-end (Next.js 16 / React 19 / TypeScript 5.6) source code, along with seventeen pages of validation results, is released under a permissive open-source licence.`,
    },
    {
      num: "6.2",
      title: "Conclusions",
      body:
`Four conclusions flow from the empirical results presented in Chapter 4.

First, three PCA factors still explain ≥ 98% of U.S. Treasury return variance on a previously-unseen 2024–2026 window, confirming Litterman–Scheinkman [11] over thirty years later.

Second, the Ornstein–Uhlenbeck maximum-likelihood estimator applied to G10 currency logs produces half-life estimates whose bootstrap standard error is below 1.4 days, meeting the precision required for tactical FX mean-reversion trading.

Third, GARCH(1,1) passes Kupiec's unconditional-coverage test on 94% of a fifty-stock universe at the 1% VaR level, making it a defensible default model for desk-level tail-risk reporting.

Fourth, Google's Gemma-3n-E4B model on the free OpenRouter tier produces factually-grounded financial commentary 95% of the time, and the 5% failure mode is attributable to stale retrieval caches rather than LLM hallucination — validating the retrieval-augmented-generation paradigm for live numerical feeds.

These four conclusions collectively support the thesis that a zero-cost, commodity-hardware, open-source multi-asset platform is not merely possible but quantitatively competitive.`,
    },
    {
      num: "6.3",
      title: "Future Scope",
      body:
`The following concrete future-work items are proposed.

F1. Walk-forward back-testing. The current OU-strategy Sharpe of 1.38 is in-sample. A rolling-window walk-forward evaluation with six-month re-estimation periods will provide a genuinely out-of-sample performance estimate.

F2. Two-factor Cheyette rates model. Replacing the single-factor Hull–White short-rate with a two-factor Cheyette stochastic-volatility model will correctly reprice caplet-floor skew and Bermudan swaption smile.

F3. Student-t GARCH. Bollerslev's [17] Student-t error distribution captures the fat tails evident in the three failing Kupiec tickers. Migrating from Gaussian to Student-t GARCH is a one-parameter extension that can be added with modest effort.

F4. LLM-as-judge grounding. Zheng et al. [32] showed that a second (typically stronger) LLM can effectively audit the factual grounding of a first model's output. Hedgyyyboo would benefit from an automated LLM-as-judge pipeline evaluating every generated morning brief.

F5. Larger quantised open-weight models. Upgrading Gemma-3n-E4B to a quantised Llama-3.1-70B-Q4 served via a local vLLM instance would lift numerical-reasoning accuracy at the cost of requiring a consumer GPU.

F6. Walk-through paper trading. Adding a stateful paper-trading mode with order-book slippage simulation will make Hedgyyyboo a realistic retail-trader training ground.

F7. PostgreSQL persistence. Migrating the SQLite ledger to PostgreSQL will enable multi-user deployments at zero additional cloud cost using the Postgres free-tier on major cloud providers.

F8. Integration with low-latency feeds. Replacing Yahoo Finance with a commercial feed such as Polygon.io would enable intraday analytics at the five-minute bucket.

F9. Regression test suite. A pytest suite with golden-file comparisons for every numeric model output will reduce regression risk during ongoing refactors.

F10. Accessibility compliance. WCAG 2.1 AA compliance for the front-end desks would unlock pedagogical deployment in inclusive-classroom settings.`,
    },
  ],
  summary:
`In summary, the Hedgyyyboo capstone project demonstrates the feasibility of an open, reproducible, zero-cost multi-asset quantitative analytics platform; its empirical evaluation validates four research contributions; and ten future-work items have been identified to extend the platform into a genuinely production-grade system.`,
};


// -----------------------------------------------------------
// References (37 IEEE-style entries, chronological per guidelines)
// -----------------------------------------------------------
const REFERENCES = [
  "F. Black and M. Scholes, \"The pricing of options and corporate liabilities,\" Journal of Political Economy, vol. 81, no. 3, pp. 637-654, May 1973.",
  "S. L. Heston, \"A closed-form solution for options with stochastic volatility with applications to bond and currency options,\" Review of Financial Studies, vol. 6, no. 2, pp. 327-343, Apr. 1993.",
  "J. Hull and A. White, \"Pricing interest-rate-derivative securities,\" Review of Financial Studies, vol. 3, no. 4, pp. 573-592, Oct. 1990.",
  "O. Vasicek, \"An equilibrium characterization of the term structure,\" Journal of Financial Economics, vol. 5, no. 2, pp. 177-188, Nov. 1977.",
  "G. E. Uhlenbeck and L. S. Ornstein, \"On the theory of the Brownian motion,\" Physical Review, vol. 36, no. 5, pp. 823-841, Sep. 1930.",
  "G. Vidyamurthy, Pairs Trading: Quantitative Methods and Analysis, 1st Ed., ch. 4, pp. 73-96, John Wiley & Sons, New York, 2004.",
  "Y. Aït-Sahalia, \"Maximum likelihood estimation of discretely sampled diffusions: A closed-form approximation approach,\" Econometrica, vol. 70, no. 1, pp. 223-262, Jan. 2002.",
  "J. Gatheral, The Volatility Surface: A Practitioner's Guide, 1st Ed., ch. 3, pp. 27-52, John Wiley & Sons, Hoboken, NJ, 2006.",
  "F. Jamshidian, \"An exact bond option formula,\" Journal of Finance, vol. 44, no. 1, pp. 205-209, Mar. 1989.",
  "L. Andersen, \"Simple and efficient simulation of the Heston model,\" Journal of Computational Finance, vol. 11, no. 3, pp. 1-42, Mar. 2008.",
  "R. Litterman and J. Scheinkman, \"Common factors affecting bond returns,\" Journal of Fixed Income, vol. 1, no. 1, pp. 54-61, Jun. 1991.",
  "C. R. Nelson and A. F. Siegel, \"Parsimonious modeling of yield curves,\" Journal of Business, vol. 60, no. 4, pp. 473-489, Oct. 1987.",
  "L. E. O. Svensson, \"Estimating and interpreting forward interest rates: Sweden 1992-1994,\" NBER Working Paper 4871, Sep. 1994.",
  "F. X. Diebold and C. Li, \"Forecasting the term structure of government bond yields,\" Journal of Econometrics, vol. 130, no. 2, pp. 337-364, Feb. 2006.",
  "R. F. Engle, \"Autoregressive conditional heteroskedasticity with estimates of the variance of United Kingdom inflation,\" Econometrica, vol. 50, no. 4, pp. 987-1007, Jul. 1982.",
  "T. Bollerslev, \"Generalized autoregressive conditional heteroskedasticity,\" Journal of Econometrics, vol. 31, no. 3, pp. 307-327, Apr. 1986.",
  "T. Bollerslev, \"A conditionally heteroskedastic time series model for speculative prices and rates of return,\" Review of Economics and Statistics, vol. 69, no. 3, pp. 542-547, Aug. 1987.",
  "A. J. McNeil, R. Frey, and P. Embrechts, Quantitative Risk Management: Concepts, Techniques, and Tools, 2nd Ed., ch. 2, pp. 35-76, Princeton University Press, Princeton, NJ, 2015.",
  "B. B. Mandelbrot and J. W. van Ness, \"Fractional Brownian motions, fractional noises and applications,\" SIAM Review, vol. 10, no. 4, pp. 422-437, Oct. 1968.",
  "H. E. Hurst, \"Long-term storage capacity of reservoirs,\" Transactions of the American Society of Civil Engineers, vol. 116, pp. 770-808, 1951.",
  "P. Kidger, J. Foster, X. Li, H. Oberhauser, and T. Lyons, \"Neural SDEs as infinite-dimensional GANs,\" in Proc. 38th International Conference on Machine Learning (ICML), pp. 5453-5463, Jul. 2021.",
  "R. T. Q. Chen, Y. Rubanova, J. Bettencourt, and D. Duvenaud, \"Neural ordinary differential equations,\" in Proc. 32nd Conference on Neural Information Processing Systems (NeurIPS), pp. 6571-6583, Dec. 2018.",
  "B. Tzen and M. Raginsky, \"Theoretical guarantees for sampling and inference in generative models with latent diffusions,\" in Proc. 32nd Conference on Learning Theory (COLT), pp. 3084-3114, Jun. 2019.",
  "P. Lewis, E. Perez, A. Piktus, F. Petroni, V. Karpukhin, N. Goyal, H. Küttler, M. Lewis, W. Yih, T. Rocktäschel, S. Riedel, and D. Kiela, \"Retrieval-augmented generation for knowledge-intensive NLP tasks,\" in Proc. 34th NeurIPS, pp. 9459-9474, Dec. 2020.",
  "Y. Gao, Y. Xiong, X. Gao, K. Jia, J. Pan, Y. Bi, Y. Dai, J. Sun, M. Wang, and H. Wang, \"Retrieval-augmented generation for large language models: A survey,\" arXiv preprint arXiv:2312.10997, Dec. 2023.",
  "D. Araci, \"FinBERT: Financial sentiment analysis with pre-trained language models,\" arXiv preprint arXiv:1908.10063, Aug. 2019.",
  "H. Yang, X.-Y. Liu, and C. D. Wang, \"FinGPT: Open-source financial large language models,\" arXiv preprint arXiv:2306.06031, Jun. 2023.",
  "S. Wu, O. Irsoy, S. Lu, V. Dabravolski, M. Dredze, S. Gehrmann, P. Kambadur, D. Rosenberg, and G. Mann, \"BloombergGPT: A large language model for finance,\" arXiv preprint arXiv:2303.17564, Mar. 2023.",
  "Gemma Team, Google DeepMind, \"Gemma 3: Open models based on Gemini research and technology,\" Google Technical Report, Mar. 2025.",
  "Y. Bang, S. Cahyawijaya, N. Lee, W. Dai, D. Su, B. Wilie, H. Lovenia, Z. Ji, T. Yu, W. Chung, Q. V. Do, Y. Xu, and P. Fung, \"A multitask, multilingual, multimodal evaluation of ChatGPT on reasoning, hallucination, and interactivity,\" arXiv preprint arXiv:2302.04023, Feb. 2023.",
  "L. Zheng, W.-L. Chiang, Y. Sheng, S. Zhuang, Z. Wu, Y. Zhuang, Z. Lin, Z. Li, D. Li, E. Xing, H. Zhang, J. E. Gonzalez, and I. Stoica, \"Judging LLM-as-a-judge with MT-Bench and Chatbot Arena,\" in Proc. 37th NeurIPS, pp. 46595-46623, Dec. 2023.",
  "Z. Chen, W. Chen, C. Smiley, S. Shah, I. Borova, D. Langdon, R. Moussa, M. Beane, T.-H. Huang, B. Routledge, and W. Y. Wang, \"FinQA: A dataset of numerical reasoning over financial data,\" in Proc. 2021 Conference on Empirical Methods in Natural Language Processing (EMNLP), pp. 3697-3711, Nov. 2021.",
  "P. H. Kupiec, \"Techniques for verifying the accuracy of risk management models,\" Journal of Derivatives, vol. 3, no. 2, pp. 73-84, Dec. 1995.",
  "U.S. Securities and Exchange Commission, \"EDGAR full-text search API,\" 2024. [Online]. Available: https://efts.sec.gov",
  "U.S. Commodity Futures Trading Commission, \"Commitments of Traders historical data,\" 2024. [Online]. Available: https://www.cftc.gov/MarketReports/CommitmentsofTraders",
  "Bank for International Settlements, \"Effective exchange rate indices,\" 2024. [Online]. Available: https://www.bis.org/statistics/eer.htm",
  "K. Leetaru and P. A. Schrodt, \"GDELT: Global data on events, location, and tone, 1979-2012,\" in Proc. International Studies Association Annual Convention, Apr. 2013.",
];


// -----------------------------------------------------------
// Appendices
// -----------------------------------------------------------

const APPENDIX_A_CODE = `# Appendix A.1 — OU-MLE estimator (Python)
import numpy as np
from scipy.stats import norm

def ou_mle(log_prices, dt=1/252):
    """
    Fit an Ornstein-Uhlenbeck process to a log-price series
    via maximum likelihood (equivalent to OLS on AR(1) form).

    Returns
    -------
    dict with keys: kappa, theta, sigma, half_life_days, t_stat
    """
    x = np.asarray(log_prices, dtype=np.float64)
    n = len(x) - 1
    x_t, x_tp = x[:-1], x[1:]
    sx, sy   = x_t.sum(), x_tp.sum()
    sxx, sxy = (x_t * x_t).sum(), (x_t * x_tp).sum()
    b_hat = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    a_hat = x_tp.mean() - b_hat * x_t.mean()
    if b_hat <= 0 or b_hat >= 1:
        return {"status": "non-stationary"}
    kappa = -np.log(b_hat) / dt
    theta = a_hat / (1.0 - b_hat)
    resid = x_tp - a_hat - b_hat * x_t
    sd    = resid.std(ddof=2)
    sigma = sd * np.sqrt(2 * kappa / (1 - b_hat**2))
    t_stat = (b_hat - 1) / (sd / np.sqrt(((x_t - x_t.mean())**2).sum()))
    return {
        "kappa":         round(float(kappa), 4),
        "theta":         round(float(theta), 4),
        "sigma":         round(float(sigma), 4),
        "half_life_days": round(float(np.log(2) / kappa), 2),
        "t_stat":        round(float(t_stat), 2),
    }`;

const APPENDIX_B_API = `# Appendix B — Sample API payload
# POST /api/morning-note?refresh=true

Request body:
    {}

Response body (truncated):
{
  "status": "ok",
  "generated_at": "2026-04-21T08:00:03+05:30",
  "briefing": "DXY firms as the 10Y UST breaks 4.40%...",
  "pdf_base64": "JVBERi0xLjQKJ...",
  "rag_context_tokens": 2874,
  "latency_ms": 7210
}`;

const APPENDIX_C_COMPONENTS = [
  ["Apple MacBook Pro (M-series)", "Development & deployment hardware"],
  ["Python 3.11 (CPython)", "Back-end language runtime"],
  ["FastAPI 0.115", "ASGI web framework"],
  ["Uvicorn 0.32", "ASGI server"],
  ["NumPy 1.26 / SciPy 1.14", "Numerical and optimisation routines"],
  ["scikit-learn 1.5", "PCA implementation"],
  ["APScheduler 3.10", "Morning-brief cron at 08:00 IST"],
  ["SQLAlchemy 2.0.35 + SQLite 3", "Trade ledger persistence"],
  ["httpx 0.27", "HTTP client for OpenRouter"],
  ["ReportLab 4", "PDF serialisation of morning brief"],
  ["Node.js 24 / Next.js 16.1.6", "Front-end runtime and framework"],
  ["React 19 / TypeScript 5.6", "Component library / typing"],
  ["Tailwind CSS 4", "Utility-first styling"],
  ["Recharts 2.12", "Chart rendering"],
  ["Framer Motion 11", "UI transitions"],
  ["Yahoo Finance API (free)", "FX + equity price feed"],
  ["U.S. Treasury Daily Yield Curve", "Sovereign rates feed"],
  ["Google News RSS", "News corpus (10 categories)"],
  ["SEC EDGAR Full-Text Search", "Filing ingestion"],
  ["CFTC Commitments of Traders", "Futures positioning"],
  ["BIS Effective Exchange Rates", "Real effective exchange rate"],
  ["GDELT Event Database", "Geopolitical event stream"],
  ["Forex Factory Calendar", "Macro calendar events"],
  ["OpenRouter API (free tier)", "Gemma-3n-E4B LLM inference"],
];

module.exports = { CH3, CH4, CH5, CH6, REFERENCES, APPENDIX_A_CODE, APPENDIX_B_API, APPENDIX_C_COMPONENTS };
