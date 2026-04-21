"""
Hedgyyyboo — FastAPI application entry point.

Phase 1: Market data, PCA/LDA analysis, LLM translation, globe data.
Phase 2: Live news, stock data, SEC filing delta, alpha checks, embeddings.
Phase 3: Volatility surface, GARCH tail risk, Monte Carlo barrier pricing.
Phase 4: RAG chatbot, morning note engine, autonomous reporting.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

import polars as pl
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from app.data_generator import generate_market_data, generate_news_headlines, get_globe_entities
from app.llm_translator import translate_analysis
from app.math_engine import run_lda_analysis, run_pca_analysis

# Phase 2 imports
from app.news_feed import fetch_news, fetch_ticker_news, fetch_market_summary
from app.stock_data import get_live_stock_data, get_stock_chart, get_batch_quotes
from app.filing_delta import compute_filing_delta
from app.alpha_check import check_post_filing_alpha
from app.embeddings import get_embedding_device

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("hedgyyyboo")

# ---------------------------------------------------------------------------
# Pre-computed data
# ---------------------------------------------------------------------------

_market_df: pl.DataFrame | None = None
_headlines: list[str] | None = None
_delta_cache: dict[str, Any] = {}
_morning_note_cache: dict[str, Any] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    global _market_df, _headlines  # noqa: PLW0603
    logger.info("Generating synthetic market data (seed=42) ...")
    _market_df = generate_market_data()
    _headlines = generate_news_headlines()
    logger.info("Data ready — %d rows, %d headlines.", _market_df.height, len(_headlines))

    # Initialize Phase 6 trade ledger
    try:
        from app.trade_ledger import init_db
        init_db()
    except Exception as exc:
        logger.warning("Trade ledger init failed (non-critical): %s", exc)

    # Start Phase 4 morning note scheduler
    try:
        from app.scheduler import start_scheduler, stop_scheduler
        start_scheduler()
    except Exception as exc:
        logger.warning("Scheduler start failed (non-critical): %s", exc)

    # Morning note is generated on-demand via REFRESH button, not on startup
    # This avoids hitting OpenRouter rate limits on the free tier
    logger.info("Morning note: on-demand mode (click REFRESH BRIEF to generate)")

    yield

    # Shutdown scheduler
    try:
        from app.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# App & middleware
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Hedgyyyboo API",
    description="Institutional-grade hedge fund research terminal backend.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AlphaCheckRequest(BaseModel):
    filing_date: str
    window_days: int = 30


# ===========================================================================
# PHASE 1 ENDPOINTS
# ===========================================================================


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "hedgyyyboo-api", "version": "2.0.0"}


@app.get("/api/market-data")
async def market_data() -> dict[str, Any]:
    assert _market_df is not None
    records = _market_df.to_dicts()
    tickers = _market_df.select("ticker").unique().to_series().to_list()
    return {"ticker_count": len(tickers), "row_count": len(records), "tickers": tickers, "data": records}


@app.post("/api/analysis/pca")
async def analysis_pca() -> dict[str, Any]:
    assert _market_df is not None
    return {"status": "ok", "analysis": "pca", "results": run_pca_analysis(_market_df)}


@app.post("/api/analysis/lda")
async def analysis_lda() -> dict[str, Any]:
    assert _headlines is not None
    return {"status": "ok", "analysis": "lda", "results": run_lda_analysis(_headlines)}


@app.post("/api/analysis/full")
async def analysis_full() -> dict[str, Any]:
    assert _market_df is not None and _headlines is not None
    pca = run_pca_analysis(_market_df)
    lda = run_lda_analysis(_headlines)
    summary = await translate_analysis(pca, lda)
    return {"status": "ok", "pca": pca, "lda": lda, "llm_summary": summary}


@app.get("/api/globe-data")
async def globe_data() -> dict[str, Any]:
    entities = get_globe_entities()
    return {"entity_count": len(entities), "entities": entities}


@app.get("/api/geo-events")
async def geo_events_endpoint(limit: int = Query(30, ge=1, le=100)) -> dict[str, Any]:
    """Geo-tagged geopolitical events for globe plotting."""
    try:
        from app.geo_events import get_geo_events
        events = get_geo_events(limit=limit)
        return {"count": len(events), "events": events}
    except Exception as exc:
        logger.error("Geo events failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Geo events failed: {exc}")


# ===========================================================================
# PHASE 2 — LIVE NEWS
# ===========================================================================


@app.get("/api/news")
async def get_news(
    category: str = Query("all"),
    limit: int = Query(30, ge=1, le=100),
) -> dict[str, Any]:
    try:
        items = fetch_news(category=category, limit=limit)
        return {"count": len(items), "category": category, "items": items}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/news/{ticker}")
async def get_ticker_news(ticker: str, limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    try:
        items = fetch_ticker_news(ticker, limit=limit)
        return {"ticker": ticker.upper(), "count": len(items), "items": items}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/market-summary")
async def get_market_summary() -> dict[str, Any]:
    return fetch_market_summary()


# ===========================================================================
# PHASE 2 — LIVE STOCK DATA (yfinance)
# ===========================================================================


@app.get("/api/stock/{ticker}")
async def stock_data(ticker: str) -> dict[str, Any]:
    data = get_live_stock_data(ticker)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@app.get("/api/stock/{ticker}/chart")
async def stock_chart(
    ticker: str,
    period: str = Query("1mo"),
) -> dict[str, Any]:
    chart = get_stock_chart(ticker, period=period)
    return {"ticker": ticker.upper(), "period": period, "data_points": len(chart), "data": chart}


@app.get("/api/stock/batch/quotes")
async def batch_quotes(
    tickers: str = Query("AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,JPM,GS,SPY"),
) -> dict[str, Any]:
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    quotes = get_batch_quotes(ticker_list)
    return {"count": len(quotes), "quotes": quotes}


# ===========================================================================
# PHASE 2 — FILING DELTA (SEC Vector Diffing)
# ===========================================================================


@app.post("/api/filing-delta/{ticker}")
async def filing_delta(
    ticker: str,
    filing_type: str = Query("10-K"),
    section: str = Query("risk_factors"),
) -> dict[str, Any]:
    cache_key = f"{ticker}_{filing_type}_{section}".upper()
    if cache_key in _delta_cache:
        return _delta_cache[cache_key]
    try:
        result = compute_filing_delta(ticker, filing_type=filing_type, section=section)
        _delta_cache[cache_key] = result
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Filing delta failed for %s: %s", ticker, exc)
        raise HTTPException(status_code=500, detail=f"Filing delta failed: {exc}")


# ===========================================================================
# PHASE 2 — ALPHA CHECK
# ===========================================================================


@app.post("/api/alpha-check/{ticker}")
async def alpha_check(ticker: str, body: AlphaCheckRequest) -> dict[str, Any]:
    return check_post_filing_alpha(ticker, body.filing_date, body.window_days)


# ===========================================================================
# PHASE 2 — SYSTEM INFO
# ===========================================================================


@app.get("/api/system/device")
async def system_device() -> dict[str, str]:
    try:
        device = get_embedding_device()
        return {"device": device, "status": "ready"}
    except Exception:
        return {"device": "not_loaded", "status": "model not yet loaded"}


# ===========================================================================
# PHASE 3 — VOLATILITY SURFACE / TAIL RISK / MONTE CARLO
# ===========================================================================


@app.get("/api/vol-surface")
async def vol_surface_endpoint(ticker: str = "SPY") -> dict[str, Any]:
    """Live 3-D implied-volatility surface from options chains."""
    try:
        from app.vol_surface import get_vol_surface

        return await get_vol_surface(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Vol surface failed for %s: %s", ticker, exc)
        raise HTTPException(status_code=500, detail=f"Vol surface failed: {exc}")


@app.get("/api/tail-risk")
async def tail_risk_endpoint() -> dict[str, Any]:
    """DCC-GARCH tail risk and cross-market contagion analysis."""
    try:
        from app.garch_engine import get_tail_risk

        return await get_tail_risk()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Tail risk engine failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Tail risk engine failed: {exc}")


@app.post("/api/monte-carlo/barrier")
async def monte_carlo_endpoint(
    ticker: str = "SPY",
    num_paths: int = 100000,
) -> dict[str, Any]:
    """PyTorch-accelerated Down-and-Out Barrier Put pricing."""
    try:
        from app.monte_carlo import price_barrier_option

        return await price_barrier_option(ticker, num_paths)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Monte Carlo pricing failed for %s: %s", ticker, exc)
        raise HTTPException(status_code=500, detail=f"Monte Carlo pricing failed: {exc}")


# ===========================================================================
# PHASE 4 — RAG CHATBOT (Ask PM)
# ===========================================================================


class AskPMRequest(BaseModel):
    query: str


@app.post("/api/ask-pm")
async def ask_pm_endpoint(body: AskPMRequest) -> dict[str, Any]:
    """REST endpoint for Ask PM — semantic router + LLM response."""
    try:
        from app.rag_brain import ask_pm

        result = await ask_pm(body.query)
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("Ask PM failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Ask PM failed: {exc}")


@app.websocket("/ws/ask-pm")
async def ask_pm_ws(websocket: WebSocket):
    """WebSocket endpoint for streaming Ask PM responses."""
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                query = msg.get("query", "")
            except json.JSONDecodeError:
                query = raw

            if not query:
                await websocket.send_json({"type": "error", "message": "Empty query"})
                continue

            # Send route classification first
            from app.rag_brain import classify_route, ask_pm

            route = classify_route(query)
            await websocket.send_json({"type": "route", "route": route})

            # Send thinking indicator
            await websocket.send_json({"type": "thinking", "message": f"Fetching live data via {route} route..."})

            # Get full response
            result = await ask_pm(query)

            # Stream the response token by token (simulate streaming)
            response_text = result.get("response", "")
            words = response_text.split(" ")
            buffer = ""
            for i, word in enumerate(words):
                buffer += word + " "
                if i % 3 == 2 or i == len(words) - 1:
                    await websocket.send_json({
                        "type": "token",
                        "content": buffer,
                        "done": i == len(words) - 1,
                    })
                    buffer = ""

            # Send metadata
            await websocket.send_json({
                "type": "complete",
                "route": result.get("route", ""),
                "data_sources": result.get("data_sources", []),
            })

    except WebSocketDisconnect:
        logger.info("Ask PM WebSocket disconnected")
    except Exception as exc:
        logger.error("Ask PM WebSocket error: %s", exc)


# ===========================================================================
# PHASE 4 — MORNING NOTE ENGINE
# ===========================================================================


@app.get("/api/morning-note/cached")
async def morning_note_cached() -> dict[str, Any]:
    """Return the cached morning note without regenerating."""
    if _morning_note_cache:
        return _morning_note_cache
    return {"status": "empty", "briefing": None, "generated_at": None}


@app.post("/api/morning-note")
async def morning_note_endpoint(refresh: bool = Query(False)) -> dict[str, Any]:
    """Return cached morning note, or regenerate if refresh=true."""
    global _morning_note_cache

    if not refresh and _morning_note_cache:
        return _morning_note_cache

    try:
        from app.morning_note import generate_morning_note

        result = await generate_morning_note()
        pdf_b64 = base64.b64encode(result["pdf_bytes"]).decode("utf-8")
        _morning_note_cache = {
            "status": "ok",
            "briefing": result["briefing"],
            "pdf_base64": pdf_b64,
            "generated_at": result["generated_at"],
            "data_sources": result["data_sources"],
        }
        return _morning_note_cache
    except Exception as exc:
        logger.error("Morning note generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Morning note failed: {exc}")


@app.get("/api/morning-note/pdf")
async def morning_note_pdf() -> Response:
    """Generate and return the morning note as a downloadable PDF."""
    try:
        from app.morning_note import generate_morning_note

        result = await generate_morning_note()
        return Response(
            content=result["pdf_bytes"],
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=hedgyyyboo_morning_note_{result['generated_at'][:10]}.pdf"
            },
        )
    except Exception as exc:
        logger.error("Morning note PDF failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Morning note PDF failed: {exc}")


# ===========================================================================
# PHASE 5 — FIXED INCOME & RATES DESK
# ===========================================================================


@app.get("/api/fixed-income")
async def fixed_income_endpoint() -> dict[str, Any]:
    """Live Treasury yields, spreads, and credit data."""
    try:
        from app.fixed_income import get_fixed_income_data

        return await get_fixed_income_data()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Fixed income data failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Fixed income failed: {exc}")


@app.post("/api/yield-curve/nss")
async def nss_fit_endpoint() -> dict[str, Any]:
    """Fit Nelson-Siegel-Svensson model to live yield curve."""
    try:
        from app.fixed_income import get_fixed_income_data
        from app.yield_curve import fit_nss

        fi_data = await get_fixed_income_data()
        curve_points = fi_data.get("curve_points", [])
        if len(curve_points) < 3:
            raise ValueError("Insufficient yield data for NSS fitting")

        return fit_nss(curve_points)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("NSS fit failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"NSS fit failed: {exc}")


@app.get("/api/yield-curve/pca")
async def yield_pca_endpoint() -> dict[str, Any]:
    """PCA decomposition of yield curve changes (Level/Slope/Curvature)."""
    try:
        from app.fixed_income import get_fixed_income_data
        from app.yield_curve import yield_curve_pca

        fi_data = await get_fixed_income_data()
        history = fi_data.get("yield_history", {})
        return yield_curve_pca(history)
    except Exception as exc:
        logger.error("Yield curve PCA failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Yield PCA failed: {exc}")


@app.post("/api/swaption/price")
async def swaption_price_endpoint(
    option_expiry: float = 1.0,
    swap_tenor: float = 5.0,
    num_paths: int = 50000,
) -> dict[str, Any]:
    """Hull-White Monte Carlo swaption pricer."""
    try:
        from app.fixed_income import get_fixed_income_data
        from app.hull_white import price_swaption

        fi_data = await get_fixed_income_data()
        curve_points = fi_data.get("curve_points", [])

        return await price_swaption(
            curve_points=curve_points,
            option_expiry=option_expiry,
            swap_tenor=swap_tenor,
            num_paths=num_paths,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Swaption pricing failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Swaption pricing failed: {exc}")


@app.get("/api/rates-brief")
async def rates_brief_endpoint() -> dict[str, Any]:
    """AI PM brief for the fixed income / rates desk."""
    try:
        from app.fixed_income import get_fixed_income_data
        from app.yield_curve import fit_nss
        from app.llm_translator import translate_rates

        fi_data = await get_fixed_income_data()

        # Try NSS fit
        nss_data = None
        try:
            curve_points = fi_data.get("curve_points", [])
            if len(curve_points) >= 3:
                nss_data = fit_nss(curve_points)
        except Exception:
            pass

        brief = await translate_rates(fi_data, nss_data)
        return {
            "status": "ok",
            "brief": brief,
            "yields": fi_data.get("yields"),
            "inversion_status": fi_data.get("inversion_status"),
        }
    except Exception as exc:
        logger.error("Rates brief failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Rates brief failed: {exc}")


# ===========================================================================
# PHASE 6 — FX MACRO DESK
# ===========================================================================


@app.get("/api/fx/spot")
async def fx_spot_endpoint() -> dict[str, Any]:
    """Live FX spot rates with sparklines."""
    try:
        from app.fx_data import get_fx_spot_rates
        return get_fx_spot_rates()
    except Exception as exc:
        logger.error("FX spot rates failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"FX spot failed: {exc}")


@app.get("/api/fx/history/{pair}")
async def fx_history_endpoint(pair: str, period: str = "1y") -> dict[str, Any]:
    """FX pair OHLCV history with realised vol."""
    try:
        from app.fx_data import get_fx_history
        fx_pair = pair.upper().replace("_", "/")
        return get_fx_history(fx_pair, period)
    except Exception as exc:
        logger.error("FX history failed for %s: %s", pair, exc)
        raise HTTPException(status_code=500, detail=f"FX history failed: {exc}")


@app.get("/api/fx/yield-diff")
async def fx_yield_diff_endpoint() -> dict[str, Any]:
    """US yield differentials for carry trade analysis."""
    try:
        from app.fx_data import get_yield_differentials
        return get_yield_differentials()
    except Exception as exc:
        logger.error("Yield diff failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Yield diff failed: {exc}")


@app.get("/api/forex-factory")
async def forex_factory_endpoint() -> dict[str, Any]:
    """Forex Factory high-impact economic events."""
    try:
        from app.forex_factory import fetch_forex_factory_events
        return fetch_forex_factory_events()
    except Exception as exc:
        logger.error("Forex Factory failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Forex Factory failed: {exc}")


@app.get("/api/cb-analysis")
async def cb_analysis_endpoint() -> dict[str, Any]:
    """Central Bank NLP hawkish/dovish analysis."""
    try:
        from app.cb_nlp import get_cb_analysis
        return await get_cb_analysis()
    except Exception as exc:
        logger.error("CB analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"CB analysis failed: {exc}")


class OURequest(BaseModel):
    pair: str = "EUR/USD"


@app.post("/api/fx/ou-mle")
async def ou_mle_endpoint(body: OURequest) -> dict[str, Any]:
    """Ornstein-Uhlenbeck MLE for FX pair."""
    try:
        import numpy as np
        from app.fx_data import get_fx_history
        from app.fx_quant_engine import fit_ou_mle

        hist = get_fx_history(body.pair, "1y")
        prices = np.array([d["close"] for d in hist["data"]])
        result = fit_ou_mle(np.log(prices))
        result["pair"] = body.pair
        result["spot_price"] = prices[-1]
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("OU MLE failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"OU MLE failed: {exc}")


@app.post("/api/fx/hurst")
async def hurst_endpoint(body: OURequest) -> dict[str, Any]:
    """Hurst exponent for FX realised volatility."""
    try:
        from app.fx_data import get_fx_realised_vol_series
        from app.fx_quant_engine import compute_hurst_exponent

        vol_series = get_fx_realised_vol_series(body.pair, window=20)
        result = compute_hurst_exponent(vol_series)
        result["pair"] = body.pair
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("Hurst failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Hurst failed: {exc}")


@app.post("/api/fx/neural-sde")
async def neural_sde_endpoint(body: OURequest) -> dict[str, Any]:
    """Neural SDE training for FX pair."""
    try:
        import numpy as np
        from app.fx_data import get_fx_history
        from app.fx_quant_engine import train_neural_sde

        hist = get_fx_history(body.pair, "1y")
        prices = np.array([d["close"] for d in hist["data"]])
        result = await train_neural_sde(prices[-120:], n_epochs=60)
        result["pair"] = body.pair
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("Neural SDE failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Neural SDE failed: {exc}")


@app.post("/api/fx/fbm")
async def fbm_endpoint(
    hurst_h: float = 0.3,
    n_paths: int = 50,
    n_steps: int = 252,
) -> dict[str, Any]:
    """Fractional Brownian Motion simulation."""
    try:
        from app.fx_quant_engine import simulate_fbm_paths
        result = simulate_fbm_paths(hurst_h, n_paths, n_steps)
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("fBM simulation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"fBM simulation failed: {exc}")


class FXTradeRequest(BaseModel):
    pair: str = "EUR/USD"


@app.post("/api/fx/execute")
async def fx_execute_endpoint(body: FXTradeRequest) -> dict[str, Any]:
    """AI PM autonomous FX trade execution."""
    try:
        from app.fx_pm_executor import execute_fx_trade
        return await execute_fx_trade(body.pair)
    except Exception as exc:
        logger.error("FX execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"FX execution failed: {exc}")


@app.get("/api/fx/trades")
async def fx_trades_endpoint(status: str = "all", limit: int = 50) -> dict[str, Any]:
    """Get trade ledger."""
    try:
        from app.trade_ledger import get_open_trades, get_all_trades
        if status == "open":
            trades = get_open_trades()
        else:
            trades = get_all_trades(limit=limit)
        return {"status": "ok", "count": len(trades), "trades": trades}
    except Exception as exc:
        logger.error("Trade ledger fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Trade ledger failed: {exc}")


@app.post("/api/fx/trades/{trade_id}/close")
async def fx_close_trade_endpoint(trade_id: int) -> dict[str, Any]:
    """Close an open trade at current market price."""
    try:
        from app.trade_ledger import close_trade
        from app.fx_data import get_fx_spot_rates

        spots = get_fx_spot_rates()
        # Get the trade to find its pair
        from app.trade_ledger import get_open_trades
        open_trades = get_open_trades()
        trade = next((t for t in open_trades if t["trade_id"] == trade_id), None)
        if not trade:
            raise ValueError(f"Trade #{trade_id} not found or already closed")

        # Find current price
        exit_price = 0
        for p in spots.get("pairs", []):
            if p["pair"] == trade["pair"]:
                exit_price = p["price"]
                break

        if exit_price == 0:
            raise ValueError(f"Cannot get spot price for {trade['pair']}")

        result = close_trade(trade_id, exit_price)
        return {"status": "ok", "trade": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Trade close failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Trade close failed: {exc}")


@app.post("/api/fx/trades/refresh-prices")
async def fx_refresh_prices_endpoint() -> dict[str, Any]:
    """Refresh all open trade prices with live spot rates."""
    try:
        from app.trade_ledger import update_all_open_prices
        from app.fx_data import get_fx_spot_rates

        spots = get_fx_spot_rates()
        live_prices = {}
        for p in spots.get("pairs", []):
            live_prices[p["pair"]] = p["price"]
            live_prices[p["pair"].replace("/", "")] = p["price"]

        updated = update_all_open_prices(live_prices)
        return {"status": "ok", "updated_count": len(updated), "trades": updated}
    except Exception as exc:
        logger.error("Price refresh failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Price refresh failed: {exc}")


# ===========================================================================
# PHASE 6 — ADVANCED DATA SOURCES (COT, BIS, GDELT, INTERBANK)
# ===========================================================================


@app.get("/api/fx/cot")
async def cftc_cot_endpoint() -> dict[str, Any]:
    """CFTC Commitments of Traders — speculative positioning."""
    try:
        from app.cftc_cot import fetch_cot_data
        return fetch_cot_data()
    except Exception as exc:
        logger.error("CFTC COT failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"CFTC COT failed: {exc}")


@app.get("/api/fx/bis-reer")
async def bis_reer_endpoint() -> dict[str, Any]:
    """BIS Real Effective Exchange Rate — structural valuation."""
    try:
        from app.bis_reer import fetch_bis_reer
        return fetch_bis_reer()
    except Exception as exc:
        logger.error("BIS REER failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"BIS REER failed: {exc}")


@app.get("/api/fx/gdelt")
async def gdelt_endpoint() -> dict[str, Any]:
    """GDELT geopolitical stress index."""
    try:
        from app.gdelt_geo import compute_geopolitical_stress_index
        return compute_geopolitical_stress_index()
    except Exception as exc:
        logger.error("GDELT failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"GDELT failed: {exc}")


@app.get("/api/fx/interbank-stress")
async def interbank_stress_endpoint() -> dict[str, Any]:
    """Cross-currency basis & interbank funding stress."""
    try:
        from app.interbank_stress import fetch_interbank_stress
        return fetch_interbank_stress()
    except Exception as exc:
        logger.error("Interbank stress failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Interbank stress failed: {exc}")
