"""
Hedgyyyboo Phase 3 — PyTorch Hardware-Accelerated Monte Carlo OTC Pricing.

Prices a Down-and-Out Barrier Put Option on a given ticker using
geometric Brownian motion simulated on GPU (CUDA), Apple Silicon (MPS),
or CPU, with live spot price and ATM implied volatility from yfinance.
"""

from __future__ import annotations

import logging
import time

import numpy as np
import torch
import yfinance as yf

logger = logging.getLogger("hedgyyyboo.monte_carlo")

# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------


def _get_device() -> torch.device:
    """Select the best available compute device."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# ---------------------------------------------------------------------------
# Live market data helpers
# ---------------------------------------------------------------------------


def _fetch_spot_and_iv(ticker: str) -> tuple[float, float]:
    """Return (spot_price, atm_implied_volatility) from live yfinance data."""
    yf_ticker = yf.Ticker(ticker)

    # Spot price
    hist = yf_ticker.history(period="1d")
    if hist.empty:
        raise ValueError(f"No price data for {ticker}")
    spot = float(hist["Close"].iloc[-1])

    # ATM implied volatility — try multiple expiries for robustness
    expiries = yf_ticker.options
    if not expiries:
        raise ValueError(f"No options expirations for {ticker}")

    iv = 0.0
    # Try expiries further out (nearest can have stale/low IVs near close)
    for exp_idx in range(min(len(expiries), 4)):
        try:
            chain = yf_ticker.option_chain(expiries[exp_idx])
            calls = chain.calls.copy()
            puts = chain.puts.copy()

            # Collect valid IVs near ATM (within 5% of spot)
            atm_lo = spot * 0.95
            atm_hi = spot * 1.05
            near_atm_calls = calls[(calls["strike"] >= atm_lo) & (calls["strike"] <= atm_hi)]
            near_atm_puts = puts[(puts["strike"] >= atm_lo) & (puts["strike"] <= atm_hi)]

            all_ivs = []
            for df in [near_atm_calls, near_atm_puts]:
                valid = df["impliedVolatility"].dropna()
                valid = valid[valid > 0.01]  # Filter sub-1% IVs (stale/erroneous)
                all_ivs.extend(valid.tolist())

            if all_ivs:
                iv = float(np.median(all_ivs))
                if iv > 0.02:  # Accept if > 2%
                    logger.info("Using IV %.4f from expiry %s (idx %d)", iv, expiries[exp_idx], exp_idx)
                    break
        except Exception as exc:
            logger.warning("Skipping expiry %s for IV: %s", expiries[exp_idx], exc)
            continue

    # Final fallback: use historical realized vol (30-day)
    if iv <= 0.02:
        logger.warning("Options IV unreliable (%.4f). Using 30-day realized vol.", iv)
        hist_30 = yf_ticker.history(period="3mo")
        if len(hist_30) >= 20:
            returns = np.log(hist_30["Close"] / hist_30["Close"].shift(1)).dropna()
            iv = float(returns.std() * np.sqrt(252))
            logger.info("Realized vol fallback: %.4f", iv)
        else:
            iv = 0.20  # Emergency fallback
            logger.warning("Using emergency IV fallback: 0.20")

    logger.info("%s live data — spot=%.2f  ATM IV=%.4f", ticker, spot, iv)
    return spot, iv


# ---------------------------------------------------------------------------
# Monte Carlo engine
# ---------------------------------------------------------------------------


async def price_barrier_option(
    ticker: str = "SPY",
    num_paths: int = 100_000,
) -> dict:
    """Price a Down-and-Out Barrier Put via Monte Carlo on GPU/MPS/CPU.

    Parameters
    ----------
    ticker : str
        Underlying ticker symbol (default ``"SPY"``).
    num_paths : int
        Number of simulated price paths (default 100 000).

    Option specification
    --------------------
    * Strike       = spot * 0.95  (5 % OTM put)
    * Barrier      = spot * 0.85  (15 % below spot — knock-out level)
    * Risk-free    = 5 %
    * Maturity     = 0.25 years  (~ 3 months / 63 trading days)

    Returns
    -------
    dict with pricing results, greeks-lite, sample paths, and perf info.
    """
    try:
        device = _get_device()
        logger.info("Monte Carlo device: %s", device)

        # ------------------------------------------------------------------
        # 1. Live market data
        # ------------------------------------------------------------------
        spot, iv = _fetch_spot_and_iv(ticker)

        # ------------------------------------------------------------------
        # 2. Option parameters
        # ------------------------------------------------------------------
        strike = spot * 0.95
        barrier = spot * 0.85
        risk_free_rate = 0.05
        maturity = 0.25
        num_steps = 63  # ~ trading days in 3 months
        dt = maturity / num_steps

        logger.info(
            "Pricing barrier put — S=%.2f K=%.2f B=%.2f sigma=%.4f r=%.4f T=%.2f paths=%d",
            spot, strike, barrier, iv, risk_free_rate, maturity, num_paths,
        )

        # ------------------------------------------------------------------
        # 3. Simulate GBM paths on device
        # ------------------------------------------------------------------
        t_start = time.perf_counter()

        # Generate random increments
        # For MPS, generate on CPU and move (MPS normal_ can be flaky)
        if device.type == "mps":
            z = torch.randn(num_paths, num_steps, dtype=torch.float32)
            z = z.to(device)
        else:
            z = torch.randn(num_paths, num_steps, dtype=torch.float32, device=device)

        # GBM increments: S_{t+1} = S_t * exp((r - 0.5*sig^2)*dt + sig*sqrt(dt)*Z)
        drift = (risk_free_rate - 0.5 * iv ** 2) * dt
        diffusion = iv * (dt ** 0.5)
        log_increments = drift + diffusion * z  # (num_paths, num_steps)

        # Cumulative sum of log increments gives log(S_t / S_0)
        log_paths = torch.cumsum(log_increments, dim=1)

        # Prepend zero for the initial price (log(S_0/S_0) = 0)
        zeros = torch.zeros(num_paths, 1, dtype=torch.float32, device=device)
        log_paths = torch.cat([zeros, log_paths], dim=1)  # (num_paths, num_steps+1)

        # Convert to price paths
        price_paths = spot * torch.exp(log_paths)  # (num_paths, num_steps+1)

        # ------------------------------------------------------------------
        # 4. Barrier check & payoff
        # ------------------------------------------------------------------
        # A path is knocked out if the minimum price along the path <= barrier
        min_prices, _ = torch.min(price_paths, dim=1)  # (num_paths,)
        knocked_out = min_prices <= barrier  # boolean mask

        # Terminal prices
        terminal_prices = price_paths[:, -1]

        # Put payoff: max(K - S_T, 0), zeroed if knocked out
        payoff = torch.clamp(strike - terminal_prices, min=0.0)
        payoff[knocked_out] = 0.0

        # Discount to present value
        discount = np.exp(-risk_free_rate * maturity)
        option_price = float(discount * payoff.mean().item())
        std_payoff = float(payoff.std().item())
        standard_error = float(discount * std_payoff / (num_paths ** 0.5))

        paths_knocked_out = int(knocked_out.sum().item())
        knockout_pct = round(paths_knocked_out / num_paths * 100, 2)

        t_end = time.perf_counter()
        computation_time_ms = round((t_end - t_start) * 1000, 2)

        # ------------------------------------------------------------------
        # 5. Sample paths for visualisation (5 paths)
        # ------------------------------------------------------------------
        # Pick 5 evenly spaced paths for representative visualisation
        sample_indices = torch.linspace(0, num_paths - 1, 5).long()
        sample_paths_tensor = price_paths[sample_indices].cpu()
        sample_paths = [
            [round(float(p), 2) for p in path]
            for path in sample_paths_tensor
        ]

        logger.info(
            "Monte Carlo done in %.1f ms — price=%.4f  SE=%.6f  KO=%.1f%%  device=%s",
            computation_time_ms, option_price, standard_error, knockout_pct, device.type,
        )

        return {
            "ticker": ticker.upper(),
            "spot_price": round(spot, 2),
            "strike": round(strike, 2),
            "barrier": round(barrier, 2),
            "iv_used": round(iv, 6),
            "risk_free_rate": risk_free_rate,
            "maturity": maturity,
            "option_price": round(option_price, 4),
            "standard_error": round(standard_error, 6),
            "num_paths": num_paths,
            "num_steps": num_steps,
            "paths_knocked_out": paths_knocked_out,
            "knockout_pct": knockout_pct,
            "device_used": device.type,
            "computation_time_ms": computation_time_ms,
            "sample_paths": sample_paths,
        }

    except ValueError:
        raise
    except Exception as exc:
        logger.exception("Monte Carlo pricing failed for %s", ticker)
        raise RuntimeError(f"Monte Carlo pricing failed: {exc}") from exc
