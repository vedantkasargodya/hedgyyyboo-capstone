"""
Per-desk technical signal packet.

Before the auto-PM asks Gemma what to do with a candidate instrument, we
compute every relevant quant signal — Ornstein-Uhlenbeck MLE, Hurst rescaled
range, GARCH(1,1) conditional vol + VaR, yield-curve PCA, recent momentum
and realised volatility — and serialise them into a compact JSON packet.

The LLM then gets a real macro-analyst brief instead of just 'last_price:X'
and responds with a structured {action, entry, stop, take_profit, size,
rationale}.  We persist the full packet into the trade's meta JSON so every
auto-opened position is fully auditable after the fact.
"""
from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.signal_packet")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_round(v: float | None, n: int = 4) -> float | None:
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    return round(float(v), n)


def _fetch_history(yf_symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame | None:
    try:
        hist = yf.Ticker(yf_symbol).history(period=period, interval=interval)
        if hist is None or hist.empty:
            return None
        return hist
    except Exception as exc:
        logger.warning("history fetch failed for %s: %s", yf_symbol, exc)
        return None


# ---------------------------------------------------------------------------
# Quant primitives (pure NumPy, no QuantLib)
# ---------------------------------------------------------------------------

def ou_mle(log_prices: np.ndarray, dt: float = 1 / 252) -> dict[str, float | str]:
    """Ornstein-Uhlenbeck maximum-likelihood via the AR(1) reparameterisation."""
    x = np.asarray(log_prices, dtype=np.float64)
    n = len(x) - 1
    if n < 30:
        return {"status": "insufficient_data"}
    x_t, x_tp = x[:-1], x[1:]
    sx, sy = x_t.sum(), x_tp.sum()
    sxx, sxy = (x_t * x_t).sum(), (x_t * x_tp).sum()
    denom = n * sxx - sx * sx
    if denom == 0:
        return {"status": "degenerate"}
    b_hat = (n * sxy - sx * sy) / denom
    a_hat = x_tp.mean() - b_hat * x_t.mean()
    if b_hat <= 0 or b_hat >= 1:
        return {"status": "non_stationary", "b_hat": round(float(b_hat), 4)}

    kappa = -math.log(b_hat) / dt
    theta = a_hat / (1.0 - b_hat)
    resid = x_tp - a_hat - b_hat * x_t
    resid_std = resid.std(ddof=2)
    sigma = resid_std * math.sqrt(2 * kappa / (1 - b_hat ** 2))
    half_life_days = math.log(2) / kappa
    # t-stat on (b_hat - 1) → Dickey–Fuller statistic
    var_x = ((x_t - x_t.mean()) ** 2).sum()
    se_b = resid_std / math.sqrt(var_x) if var_x > 0 else float("inf")
    t_stat = (b_hat - 1) / se_b if se_b > 0 else 0.0
    # Current deviation from mean (normalised)
    current_dev = (x[-1] - theta) / sigma if sigma > 0 else 0.0
    return {
        "status": "ok",
        "kappa": _safe_round(kappa),
        "theta": _safe_round(theta),
        "sigma": _safe_round(sigma),
        "half_life_days": _safe_round(half_life_days, 2),
        "t_stat": _safe_round(t_stat, 2),
        "is_mean_reverting": bool(kappa > 0 and t_stat < -2.89),  # 5% DF crit
        "current_dev_sigmas": _safe_round(current_dev, 3),
    }


def hurst_rs(returns: np.ndarray) -> dict[str, Any]:
    """Hurst exponent via R/S analysis.  H<0.5 mean-reverting, =0.5 random, >0.5 trending."""
    r = np.asarray(returns, dtype=np.float64)
    if len(r) < 64:
        return {"status": "insufficient_data"}
    block_sizes = [8, 16, 32, 64]
    rs_vals, log_sizes = [], []
    for n in block_sizes:
        if n >= len(r):
            continue
        segments = len(r) // n
        trimmed = r[: segments * n].reshape(segments, n)
        rs_per_segment = []
        for seg in trimmed:
            mean = seg.mean()
            cum = np.cumsum(seg - mean)
            R = cum.max() - cum.min()
            S = seg.std(ddof=1)
            if S > 0:
                rs_per_segment.append(R / S)
        if rs_per_segment:
            rs_vals.append(np.mean(rs_per_segment))
            log_sizes.append(n)
    if len(rs_vals) < 2:
        return {"status": "degenerate"}
    # slope of log(R/S) ~ H * log(n) + c
    logn = np.log(log_sizes)
    logrs = np.log(rs_vals)
    h, _ = np.polyfit(logn, logrs, 1)
    label = "MEAN_REVERTING" if h < 0.45 else "TRENDING" if h > 0.55 else "RANDOM_WALK"
    return {"status": "ok", "hurst": _safe_round(h, 3), "regime": label}


def garch_forecast(returns: np.ndarray, alpha_level: float = 0.01) -> dict[str, Any]:
    """GARCH(1,1) Gaussian: one-day-ahead conditional vol + parametric VaR/ES."""
    try:
        from arch import arch_model
        from scipy.stats import norm
    except Exception:
        return {"status": "arch_not_installed"}
    r = np.asarray(returns, dtype=np.float64)
    r = r[np.isfinite(r)]
    if len(r) < 100:
        return {"status": "insufficient_data"}
    try:
        am = arch_model(r * 100, vol="Garch", p=1, q=1, dist="normal")
        res = am.fit(disp="off", show_warning=False)
        omega = float(res.params.get("omega", float("nan")))
        alpha_g = float(res.params.get("alpha[1]", float("nan")))
        beta_g  = float(res.params.get("beta[1]", float("nan")))
        forecast = res.forecast(horizon=1, reindex=False)
        next_var = float(forecast.variance.iloc[-1, 0]) / 10000.0  # undo *100 scaling
        next_vol = math.sqrt(next_var)
        mu = float(r.mean())
        z = float(norm.ppf(alpha_level))
        var_daily = -(mu + next_vol * z)
        es_daily = -mu + next_vol * float(norm.pdf(z)) / alpha_level
        return {
            "status": "ok",
            "omega": _safe_round(omega, 6),
            "alpha": _safe_round(alpha_g, 4),
            "beta": _safe_round(beta_g, 4),
            "persistence": _safe_round(alpha_g + beta_g, 4),
            "forecast_daily_vol_pct": _safe_round(next_vol * 100, 3),
            "var_1pct_daily_pct": _safe_round(var_daily * 100, 3),
            "es_1pct_daily_pct": _safe_round(es_daily * 100, 3),
        }
    except Exception as exc:
        return {"status": f"fit_failed:{type(exc).__name__}"}


def price_summary(close: pd.Series) -> dict[str, float | None]:
    """Recent momentum + range stats that any desk cares about."""
    if close is None or len(close) < 22:
        return {"status": "insufficient_data"}
    last = float(close.iloc[-1])
    ret_1d  = float(close.iloc[-1] / close.iloc[-2] - 1) if len(close) >= 2  else None
    ret_5d  = float(close.iloc[-1] / close.iloc[-6] - 1) if len(close) >= 6  else None
    ret_20d = float(close.iloc[-1] / close.iloc[-21] - 1) if len(close) >= 21 else None
    hi_52 = float(close.tail(252).max()) if len(close) >= 1 else None
    lo_52 = float(close.tail(252).min()) if len(close) >= 1 else None
    pos_in_range = (last - lo_52) / (hi_52 - lo_52) if hi_52 and hi_52 != lo_52 else None
    realised_vol_20d = float(close.pct_change().tail(20).std() * math.sqrt(252)) if len(close) >= 21 else None
    return {
        "status": "ok",
        "last": _safe_round(last, 5),
        "ret_1d_pct":  _safe_round(ret_1d  * 100 if ret_1d  is not None else None, 3),
        "ret_5d_pct":  _safe_round(ret_5d  * 100 if ret_5d  is not None else None, 3),
        "ret_20d_pct": _safe_round(ret_20d * 100 if ret_20d is not None else None, 3),
        "hi_52w": _safe_round(hi_52, 4),
        "lo_52w": _safe_round(lo_52, 4),
        "range_position_pct": _safe_round(pos_in_range * 100 if pos_in_range is not None else None, 1),
        "realised_vol_20d_ann": _safe_round(realised_vol_20d, 4),
    }


# ---------------------------------------------------------------------------
# Desk-specific packet builders
# ---------------------------------------------------------------------------

def _fx_packet(symbol: str) -> dict[str, Any]:
    yf_sym = symbol.replace("/", "") + "=X"
    hist = _fetch_history(yf_sym, period="1y")
    if hist is None:
        return {"desk": "FX", "symbol": symbol, "status": "no_history"}
    close = hist["Close"].dropna()
    log_prices = np.log(close.values)
    rets = close.pct_change().dropna().values

    # Forex Factory upcoming events for this base / quote currency (safe
    # lookup — function may not always return the pair we want).
    ff_events: list[dict[str, Any]] = []
    try:
        from app.forex_factory import get_next_events  # optional
        ff_events = get_next_events(pair=symbol, lookahead_hours=24)[:5]
    except Exception:
        pass

    return {
        "desk": "FX",
        "symbol": symbol,
        "status": "ok",
        "price": price_summary(close),
        "ou_mle": ou_mle(log_prices),
        "hurst": hurst_rs(rets),
        "garch": garch_forecast(rets),
        "upcoming_high_impact_events_24h": ff_events,
    }


def _equity_packet(symbol: str) -> dict[str, Any]:
    hist = _fetch_history(symbol, period="1y")
    if hist is None:
        return {"desk": "EQUITY", "symbol": symbol, "status": "no_history"}
    close = hist["Close"].dropna()
    rets = close.pct_change().dropna().values
    return {
        "desk": "EQUITY",
        "symbol": symbol,
        "status": "ok",
        "price": price_summary(close),
        "hurst": hurst_rs(rets),
        "garch": garch_forecast(rets),
        # OU is less meaningful on trending equities but we include the stat
        # so the LLM can reason about mean-reversion opportunities post-gap.
        "ou_mle": ou_mle(np.log(close.values)),
    }


_RATES_SYMBOLS = {
    "UST10Y": "^TNX",
    "UST5Y":  "^FVX",
    "UST30Y": "^TYX",
    "UST3M":  "^IRX",
}


def _rates_packet(symbol: str) -> dict[str, Any]:
    # Pull the full UST strip so we can compute slope + PCA-lite stats.
    closes: dict[str, pd.Series] = {}
    for name, yf_sym in _RATES_SYMBOLS.items():
        h = _fetch_history(yf_sym, period="6mo")
        if h is not None and not h.empty:
            closes[name] = h["Close"].dropna()

    if symbol not in closes or closes[symbol].empty:
        return {"desk": "RATES", "symbol": symbol, "status": "no_history"}

    subject = closes[symbol]
    rets = subject.pct_change().dropna().values

    # Level / Slope / Curvature proxy from the tenors we managed to pull
    latest = {k: float(v.iloc[-1]) for k, v in closes.items() if not v.empty}
    slope_10_3m = latest.get("UST10Y", 0.0) - latest.get("UST3M", 0.0)
    slope_10_5  = latest.get("UST10Y", 0.0) - latest.get("UST5Y", 0.0)
    curvature   = 2 * latest.get("UST5Y", 0.0) - latest.get("UST3M", 0.0) - latest.get("UST10Y", 0.0)

    return {
        "desk": "RATES",
        "symbol": symbol,
        "status": "ok",
        "yields_today": {k: round(v, 3) for k, v in latest.items()},
        "slope_10y_3m_bps":  _safe_round(slope_10_3m * 100, 1),
        "slope_10y_5y_bps":  _safe_round(slope_10_5 * 100, 1),
        "curvature_bps":      _safe_round(curvature * 100, 1),
        "price": price_summary(subject),
        "garch": garch_forecast(rets),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_signal_packet(desk: str, symbol: str) -> dict[str, Any]:
    desk_u = desk.upper()
    if desk_u == "FX":
        return _fx_packet(symbol)
    if desk_u == "EQUITY":
        return _equity_packet(symbol)
    if desk_u == "RATES":
        return _rates_packet(symbol)
    return {"desk": desk_u, "symbol": symbol, "status": "unknown_desk"}
