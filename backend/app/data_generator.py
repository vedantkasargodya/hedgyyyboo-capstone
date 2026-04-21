"""
Hedgyyyboo — Synthetic market data generator.

Produces reproducible dummy data for 50 global tickers, macro news
headlines, and 3-D globe entity markers.
"""

from __future__ import annotations

import numpy as np
import polars as pl

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SEED = 42
TRADING_DAYS = 252

TICKERS: list[dict[str, str]] = [
    # US — Tech
    {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Tech", "region": "US"},
    {"ticker": "MSFT", "name": "Microsoft Corp.", "sector": "Tech", "region": "US"},
    {"ticker": "NVDA", "name": "NVIDIA Corp.", "sector": "Tech", "region": "US"},
    {"ticker": "GOOGL", "name": "Alphabet Inc.", "sector": "Tech", "region": "US"},
    {"ticker": "META", "name": "Meta Platforms", "sector": "Tech", "region": "US"},
    {"ticker": "AMZN", "name": "Amazon.com Inc.", "sector": "Tech", "region": "US"},
    {"ticker": "CRM", "name": "Salesforce Inc.", "sector": "Tech", "region": "US"},
    {"ticker": "ORCL", "name": "Oracle Corp.", "sector": "Tech", "region": "US"},
    # US — Finance
    {"ticker": "JPM", "name": "JPMorgan Chase", "sector": "Finance", "region": "US"},
    {"ticker": "GS", "name": "Goldman Sachs", "sector": "Finance", "region": "US"},
    {"ticker": "MS", "name": "Morgan Stanley", "sector": "Finance", "region": "US"},
    {"ticker": "BAC", "name": "Bank of America", "sector": "Finance", "region": "US"},
    # US — Energy
    {"ticker": "XOM", "name": "Exxon Mobil", "sector": "Energy", "region": "US"},
    {"ticker": "CVX", "name": "Chevron Corp.", "sector": "Energy", "region": "US"},
    # US — Healthcare
    {"ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare", "region": "US"},
    {"ticker": "UNH", "name": "UnitedHealth Group", "sector": "Healthcare", "region": "US"},
    {"ticker": "PFE", "name": "Pfizer Inc.", "sector": "Healthcare", "region": "US"},
    # US — Consumer
    {"ticker": "PG", "name": "Procter & Gamble", "sector": "Consumer", "region": "US"},
    {"ticker": "KO", "name": "Coca-Cola Co.", "sector": "Consumer", "region": "US"},
    # India
    {"ticker": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy", "region": "India"},
    {"ticker": "TCS.NS", "name": "Tata Consultancy", "sector": "Tech", "region": "India"},
    {"ticker": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Finance", "region": "India"},
    {"ticker": "INFY.NS", "name": "Infosys Ltd.", "sector": "Tech", "region": "India"},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Finance", "region": "India"},
    {"ticker": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "Consumer", "region": "India"},
    {"ticker": "TATAMOTORS.NS", "name": "Tata Motors", "sector": "Consumer", "region": "India"},
    {"ticker": "SUNPHARMA.NS", "name": "Sun Pharma", "sector": "Healthcare", "region": "India"},
    # UK
    {"ticker": "HSBA.L", "name": "HSBC Holdings", "sector": "Finance", "region": "UK"},
    {"ticker": "SHEL.L", "name": "Shell plc", "sector": "Energy", "region": "UK"},
    {"ticker": "AZN.L", "name": "AstraZeneca", "sector": "Healthcare", "region": "UK"},
    {"ticker": "ULVR.L", "name": "Unilever plc", "sector": "Consumer", "region": "UK"},
    {"ticker": "BP.L", "name": "BP plc", "sector": "Energy", "region": "UK"},
    {"ticker": "RIO.L", "name": "Rio Tinto", "sector": "Materials", "region": "UK"},
    # Japan
    {"ticker": "7203.T", "name": "Toyota Motor", "sector": "Consumer", "region": "Japan"},
    {"ticker": "6758.T", "name": "Sony Group", "sector": "Tech", "region": "Japan"},
    {"ticker": "8306.T", "name": "Mitsubishi UFJ", "sector": "Finance", "region": "Japan"},
    {"ticker": "6902.T", "name": "Denso Corp.", "sector": "Consumer", "region": "Japan"},
    {"ticker": "4502.T", "name": "Takeda Pharma", "sector": "Healthcare", "region": "Japan"},
    {"ticker": "6501.T", "name": "Hitachi Ltd.", "sector": "Tech", "region": "Japan"},
    {"ticker": "5401.T", "name": "Nippon Steel", "sector": "Materials", "region": "Japan"},
    # China / Hong Kong
    {"ticker": "9988.HK", "name": "Alibaba Group", "sector": "Tech", "region": "China"},
    {"ticker": "0700.HK", "name": "Tencent Holdings", "sector": "Tech", "region": "China"},
    {"ticker": "3690.HK", "name": "Meituan", "sector": "Consumer", "region": "China"},
    {"ticker": "1398.HK", "name": "ICBC", "sector": "Finance", "region": "China"},
    {"ticker": "0939.HK", "name": "CCB", "sector": "Finance", "region": "China"},
    {"ticker": "0857.HK", "name": "PetroChina", "sector": "Energy", "region": "China"},
    {"ticker": "2318.HK", "name": "Ping An Insurance", "sector": "Finance", "region": "China"},
    {"ticker": "1211.HK", "name": "BYD Company", "sector": "Consumer", "region": "China"},
    {"ticker": "3968.HK", "name": "China Merchants Bank", "sector": "Finance", "region": "China"},
    {"ticker": "2269.HK", "name": "WuXi Biologics", "sector": "Healthcare", "region": "China"},
]

# Sector-level annualised drift and vol parameters
SECTOR_PARAMS: dict[str, dict[str, float]] = {
    "Tech":       {"drift": 0.15, "vol": 0.25},
    "Finance":    {"drift": 0.08, "vol": 0.20},
    "Energy":     {"drift": 0.05, "vol": 0.30},
    "Healthcare": {"drift": 0.10, "vol": 0.18},
    "Materials":  {"drift": 0.04, "vol": 0.28},
    "Consumer":   {"drift": 0.07, "vol": 0.16},
}

# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------


def generate_market_data() -> pl.DataFrame:
    """Return a Polars DataFrame of daily returns for 50 global tickers.

    Columns: ``date | ticker | sector | region | price | daily_return``
    252 trading days per ticker, seeded for reproducibility.
    """
    rng = np.random.default_rng(SEED)

    # Common market factor (explains ~30 % of variance)
    market_factor = rng.normal(0.0004, 0.01, size=TRADING_DAYS)

    records: list[dict] = []
    base_date = np.datetime64("2025-03-10")

    for meta in TICKERS:
        params = SECTOR_PARAMS[meta["sector"]]
        daily_drift = params["drift"] / TRADING_DAYS
        daily_vol = params["vol"] / np.sqrt(TRADING_DAYS)

        # Sector-correlated component + idiosyncratic noise
        sector_loading = rng.uniform(0.3, 0.6)
        idio_returns = rng.normal(daily_drift, daily_vol, size=TRADING_DAYS)
        returns = sector_loading * market_factor + (1 - sector_loading) * idio_returns

        # Build a price path starting at a reasonable level
        start_price = rng.uniform(20.0, 500.0)
        prices = start_price * np.cumprod(1 + returns)

        for day_idx in range(TRADING_DAYS):
            records.append(
                {
                    "date": str(base_date + np.timedelta64(day_idx, "D")),
                    "ticker": meta["ticker"],
                    "name": meta["name"],
                    "sector": meta["sector"],
                    "region": meta["region"],
                    "price": round(float(prices[day_idx]), 2),
                    "daily_return": round(float(returns[day_idx]), 6),
                }
            )

    return pl.DataFrame(records)


# ---------------------------------------------------------------------------
# News headlines
# ---------------------------------------------------------------------------

_HEADLINE_TEMPLATES: dict[str, list[str]] = {
    "US Fed Rate Policy": [
        "Fed signals potential rate pause amid cooling inflation data",
        "FOMC minutes reveal divided committee on terminal rate",
        "Powell reiterates data-dependent approach to monetary policy",
        "Treasury yields surge as strong jobs report boosts rate-hike bets",
        "Markets price in 75 bps of cuts after soft CPI reading",
        "Fed balance sheet runoff accelerates to $95B monthly",
        "Regional bank stress reignites calls for emergency rate cuts",
        "Inflation expectations anchored despite commodity spike says Fed",
        "Fed officials push back against aggressive easing expectations",
        "Core PCE surprises to upside, complicating dovish pivot",
        "Two-year Treasury hits 5% as rate-cut hopes fade",
        "US fiscal deficit widens, Treasury supply concerns mount",
        "Fed dot plot signals higher-for-longer stance through 2026",
        "Money markets flash stress signals as overnight rates diverge",
        "Fed reverse repo facility drawdown accelerates sharply",
        "Wall Street strategists split on terminal rate forecast",
        "US retail sales beat expectations, supporting hawkish Fed stance",
        "Fed chair warns against premature victory on inflation",
        "Yield curve inversion deepens, recession signals intensify",
        "Dollar strengthens broadly as rate differential widens",
        "Fed emergency lending facility usage ticks higher in Q4",
        "Housing starts collapse as mortgage rates breach 7.5%",
        "US consumer confidence drops sharply on rate uncertainty",
        "Banks tighten lending standards for 6th consecutive quarter",
        "Fed stress test results reveal capital shortfall at 3 regionals",
        "Breakeven inflation rates climb to 18-month highs",
        "Swap markets reprice terminal rate 50 bps higher overnight",
        "US government shutdown risk adds volatility to rates markets",
        "Treasury auction sees weakest demand since 2021",
        "Fed Beige Book reports slowing economic activity across 8 districts",
        "Quantitative tightening enters final phase says NY Fed president",
        "Real interest rates turn positive for first time since 2019",
        "Primary dealers warn of liquidity deterioration in Treasuries",
        "Fed officials debate symmetric inflation target amid critiques",
        "US manufacturing PMI drops below 50 for 4th straight month",
        "Jobless claims tick up, fueling soft-landing narrative",
        "Fed minutes show staff models projecting mild recession",
        "Short-term funding markets seize up briefly on quarter-end",
        "US core services inflation proves sticky above 4%",
        "Fed announces new standing repo facility to ease market stress",
    ],
    "Asian Supply Chain Disruption": [
        "Taiwan chip exports hit record amid AI demand surge",
        "China factory output slows as property sector weighs on growth",
        "Japan auto exports disrupted by semiconductor shortages",
        "South Korea shipbuilding orders surge on LNG carrier demand",
        "Vietnam manufacturing PMI falls below 50 on weak orders",
        "India announces PLI scheme expansion for electronics manufacturing",
        "Container freight rates spike 40% on Red Sea diversions",
        "China rare earth export controls disrupt EV battery supply chains",
        "ASEAN nations compete for Apple supplier diversification",
        "Japan machine tool orders drop 15% signaling capex slowdown",
        "Port congestion in Singapore delays shipments across Southeast Asia",
        "Samsung warns of DRAM supply tightness through H1 2026",
        "Bangladesh garment exports fall as European demand weakens",
        "China solar panel oversupply crashes module prices 30%",
        "Indian pharmaceutical exports face FDA compliance scrutiny",
        "Thailand floods threaten hard disk drive production capacity",
        "Philippines nickel export ban disrupts stainless steel supply",
        "TSMC Arizona fab delays push back US chip production timeline",
        "Malaysia palm oil exports hit by weather-related shortfalls",
        "China imposes export controls on graphite for EV batteries",
        "Japanese yen weakness boosts export competitiveness of automakers",
        "South Korea battery makers face raw material cost squeeze",
        "Indonesia halts bauxite exports to boost domestic processing",
        "Supply chain decoupling accelerates as firms adopt China-plus-one",
        "Labor shortages in Asian factories drive automation investment",
        "Shipping alliances restructure routes amid geopolitical tensions",
        "Chinese steel exports surge, raising global overcapacity concerns",
        "India emerges as key iPhone assembly hub for Apple supply chain",
        "Asian chipmakers announce coordinated capex cuts on demand fears",
        "Cross-border data flow restrictions complicate Asia tech supply chains",
        "Myanmar political instability disrupts critical mineral exports",
        "Air freight demand from Asia surges on e-commerce growth",
        "Japanese chemical exports face competition from Saudi mega-projects",
        "Cambodia garment sector rebounds on shifting orders from China",
        "Asian LNG spot prices spike on early winter demand from Japan",
        "Foxconn accelerates India expansion with new Karnataka plant",
        "Global shipping lines cut Asia-Europe capacity by 20%",
        "Korean auto exports threatened by EU carbon border adjustment",
        "Taiwan earthquake disrupts chip packaging operations temporarily",
        "Asian supply chain resilience tested by simultaneous disruptions",
    ],
    "European Energy Crisis": [
        "EU natural gas storage hits 90% ahead of winter season",
        "German industrial output falls for 5th month on energy costs",
        "European utilities invest heavily in offshore wind capacity",
        "France nuclear fleet restarts stabilize baseload power supply",
        "UK energy price cap reduced but still double pre-crisis levels",
        "Norway gas exports to Europe reach record volumes",
        "European carbon credit prices breach EUR 100 per tonne",
        "Italy secures new LNG supply deal with Algeria",
        "Dutch TTF gas futures spike on cold weather forecast",
        "European steel mills idle capacity amid power cost squeeze",
        "Spain solar output sets daily generation record",
        "Poland accelerates nuclear power program to reduce coal dependence",
        "EU hydrogen strategy faces infrastructure funding shortfall",
        "German chemical giants shift production to US on energy arbitrage",
        "European grid operators warn of winter peak demand risks",
        "Offshore wind auction prices rise sharply across North Sea",
        "EU agrees emergency gas price cap mechanism",
        "UK North Sea oil and gas investment drops on windfall tax",
        "European battery storage deployments triple year-over-year",
        "Baltic states complete energy grid synchronization with EU",
        "LNG terminal construction boom transforms European gas market",
        "European automakers face energy-intensive EV production costs",
        "Heat pump installations surge across Northern Europe",
        "EU border carbon tax implementation creates trade friction",
        "Greek and Turkish tensions complicate Eastern Mediterranean gas plans",
        "European electricity market reform debate divides member states",
        "Industrial demand destruction reshapes European energy balance",
        "EU fast-tracks permitting for renewable energy projects",
        "Cross-border power interconnectors reduce price volatility",
        "European energy majors pivot capex toward renewables",
        "Germany debates extending remaining nuclear plant operations",
        "EU launches joint gas purchasing platform for member states",
        "Iberian exception gas price cap model studied for wider adoption",
        "European petrochemical margins collapse on feedstock cost pressure",
        "UK grid operator procures record battery storage capacity",
        "Alpine hydropower output falls on below-average snowpack",
        "EU green bond issuance surges to fund energy transition",
        "Russia pipeline gas flows to Europe near zero",
        "European refinery closures accelerate on margin deterioration",
        "Nordic power surplus creates opportunity for data center expansion",
    ],
    "Tech Earnings & AI Boom": [
        "NVIDIA data center revenue surges 200% on AI chip demand",
        "Microsoft Azure AI services revenue exceeds $10B quarterly run rate",
        "Google DeepMind breakthrough accelerates drug discovery pipeline",
        "Apple Vision Pro enterprise adoption slower than expected",
        "Meta AI assistant reaches 500M monthly active users",
        "Amazon AWS AI inference revenue grows 150% year-over-year",
        "OpenAI valuation reportedly reaches $150B in latest funding round",
        "Semiconductor equipment makers report record order backlogs",
        "Enterprise AI spending forecast revised upward to $500B by 2027",
        "TSMC advanced node utilization hits 100% on AI accelerator demand",
        "Cloud hyperscalers capex reaches $200B collectively in 2025",
        "AI-powered coding assistants reduce software development costs 30%",
        "Broadcom custom AI chip revenue triples on hyperscaler contracts",
        "European AI regulation creates compliance overhead for tech firms",
        "Autonomous vehicle deployments expand to 50 US cities",
        "AI data center power demand strains regional electricity grids",
        "Samsung launches next-gen HBM4 memory for AI training workloads",
        "Adobe AI creative tools drive subscription revenue growth",
        "Cisco networking equipment demand spikes on AI infrastructure build",
        "Palantir defense AI contracts double amid geopolitical tensions",
        "AI chip startup landscape consolidates as funding tightens",
        "AMD gains data center GPU market share with MI400 launch",
        "Global AI patent filings dominated by US and Chinese firms",
        "Intel foundry services win first major external AI chip contract",
        "Anthropic raises $5B round led by major sovereign wealth funds",
        "AI model training costs decline 50% year-over-year on efficiency gains",
        "Oracle cloud infrastructure sees 80% growth from AI workloads",
        "SoftBank Vision Fund doubles down on AI infrastructure investments",
        "Microsoft Copilot enterprise seat count surpasses 50M",
        "ASML EUV tool demand exceeds production capacity through 2027",
        "AI-driven quantitative trading strategies outperform benchmarks",
        "Alibaba Cloud launches competitive LLM challenging Western models",
        "Vertex AI and Bedrock battle for enterprise MLOps dominance",
        "GPU rental market emerges as alternative to owning AI infrastructure",
        "AI safety research funding increases 400% from 2024 levels",
        "Arm Holdings revenue surges on AI-optimized chip design licensing",
        "Global semiconductor revenue forecast raised to $700B for 2026",
        "AI-powered customer service reduces call center costs by 40%",
        "Quantum computing advances threaten current encryption standards",
        "Tech earnings beat expectations but guidance disappoints on margins",
    ],
    "Emerging Market Currency Risk": [
        "Turkish lira hits new low as central bank credibility questioned",
        "Indian rupee depreciates to record low against surging dollar",
        "Brazilian real volatility spikes on fiscal policy uncertainty",
        "South African rand whipsaws on political coalition instability",
        "Nigerian naira stabilizes after painful exchange rate unification",
        "Argentine peso official rate adjustment narrows parallel market gap",
        "Egyptian pound faces renewed pressure as hot money exits",
        "Indonesian rupiah intervention reserves drop to 5-year low",
        "Mexican peso strength reverses on nearshoring sentiment shift",
        "Thai baht weakens as tourism recovery disappoints expectations",
        "EM central banks rebuild reserves as dollar strength persists",
        "Frontier market dollar bonds sell off on risk aversion",
        "Philippine peso hits decade low prompting BSP intervention",
        "Ghana completes debt restructuring under IMF program",
        "Pakistan rupee stabilizes on resumed IMF disbursements",
        "EM local currency bond funds see $20B outflows in Q4",
        "Vietnamese dong devaluation risk rises on trade imbalance",
        "Colombian peso drops sharply on leftist policy concerns",
        "Kenya shilling rallies after Eurobond buyback announcement",
        "EM carry trades unwind as Fed rate expectations shift higher",
        "Chile copper revenue decline pressures peso and fiscal accounts",
        "Sri Lanka rupee recovery stalls on debt service obligations",
        "Saudi riyal peg faces speculation amid oil revenue decline",
        "EM sovereign credit default swap spreads widen across the board",
        "Polish zloty weakens on EU rule-of-law funding dispute",
        "Malaysian ringgit falls to 1998 crisis levels against dollar",
        "EM central banks coordinate intervention to stem capital outflows",
        "Zambia kwacha rebounds after copper price recovery",
        "Hungarian forint under pressure from unorthodox monetary policy",
        "Bangladesh taka devaluation drives imported inflation surge",
        "EM FX reserves adequacy ratios deteriorate across major economies",
        "Romania leu band defended by aggressive central bank tightening",
        "Peru sol hit by political instability and mining sector disruption",
        "Czech koruna outperforms EM peers on EU convergence trade",
        "EM dollar-denominated corporate debt refinancing wall approaching",
        "Morocco dirham basket reweighting signals gradual liberalization",
        "India capital controls debated as portfolio outflows accelerate",
        "EM currency crisis contagion risk flagged by IMF stability report",
        "Costa Rica colon dollarization trend accelerates",
        "Ivory Coast CFA franc zone tensions rise on euro weakness",
    ],
}


def generate_news_headlines() -> list[str]:
    """Return 200 dummy macro news headlines drawn from five thematic buckets."""
    headlines: list[str] = []
    for topic_headlines in _HEADLINE_TEMPLATES.values():
        headlines.extend(topic_headlines)
    return headlines


# ---------------------------------------------------------------------------
# Globe entities
# ---------------------------------------------------------------------------


def get_globe_entities() -> list[dict]:
    """Return entity markers for the 3-D globe visualisation."""
    return [
        {
            "name": "United States",
            "lat": 39.8,
            "lng": -98.5,
            "risk_score": 35,
            "gdp_growth": 2.1,
            "top_sectors": ["Tech", "Finance", "Healthcare"],
            "active_positions": 19,
            "alert_level": "normal",
        },
        {
            "name": "India",
            "lat": 20.5,
            "lng": 78.9,
            "risk_score": 52,
            "gdp_growth": 6.8,
            "top_sectors": ["Tech", "Finance", "Energy"],
            "active_positions": 8,
            "alert_level": "warning",
        },
        {
            "name": "United Kingdom",
            "lat": 55.3,
            "lng": -3.4,
            "risk_score": 41,
            "gdp_growth": 0.9,
            "top_sectors": ["Finance", "Energy", "Materials"],
            "active_positions": 6,
            "alert_level": "normal",
        },
        {
            "name": "Japan",
            "lat": 36.2,
            "lng": 138.2,
            "risk_score": 38,
            "gdp_growth": 1.2,
            "top_sectors": ["Consumer", "Tech", "Finance"],
            "active_positions": 7,
            "alert_level": "normal",
        },
        {
            "name": "China",
            "lat": 35.8,
            "lng": 104.1,
            "risk_score": 68,
            "gdp_growth": 4.5,
            "top_sectors": ["Tech", "Finance", "Consumer"],
            "active_positions": 10,
            "alert_level": "critical",
        },
    ]
