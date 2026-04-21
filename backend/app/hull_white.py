"""
Hedgyyyboo Phase 5 — Hull-White One-Factor Swaption Pricer.

PyTorch-accelerated Monte Carlo simulation of the Hull-White short rate
model for pricing European swaptions. Uses GPU/MPS/CPU auto-detection.

Hull-White SDE: dr(t) = [theta(t) - a*r(t)] dt + sigma * dW(t)

Where:
  a     = mean reversion speed
  sigma = short rate volatility
  theta = time-dependent drift (calibrated to initial term structure)
"""

from __future__ import annotations

import logging
import time
from typing import Any

import numpy as np
import torch

logger = logging.getLogger("hedgyyyboo.hull_white")


# ---------------------------------------------------------------------------
# Device detection (shared with monte_carlo.py)
# ---------------------------------------------------------------------------

def _get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# ---------------------------------------------------------------------------
# Hull-White Model
# ---------------------------------------------------------------------------


def _calibrate_theta(
    r0: float,
    a: float,
    sigma: float,
    term_structure: list[dict[str, float]],
    dt: float,
    num_steps: int,
) -> np.ndarray:
    """Calibrate time-dependent theta to match the initial term structure.

    Uses the closed-form: theta(t) = df/dt + a*f(t) + (sigma^2/(2a))*(1-exp(-2at))
    where f(t) is the instantaneous forward rate from the initial term structure.
    """
    # Build forward rate curve from term structure
    if len(term_structure) < 2:
        # Constant theta fallback
        return np.full(num_steps, a * r0)

    maturities = np.array([p["maturity"] for p in term_structure])
    yields_arr = np.array([p["yield"] / 100.0 for p in term_structure])  # Convert % to decimal

    # Interpolate yields at simulation time points
    times = np.linspace(dt, num_steps * dt, num_steps)
    interp_yields = np.interp(times, maturities, yields_arr, left=yields_arr[0], right=yields_arr[-1])

    # Forward rates: f(t) ~ y(t) + t * dy/dt
    dy_dt = np.gradient(interp_yields, times)
    forward_rates = interp_yields + times * dy_dt

    # Theta calibration
    df_dt = np.gradient(forward_rates, times)
    theta = df_dt + a * forward_rates + (sigma ** 2 / (2 * a)) * (1 - np.exp(-2 * a * times))

    return theta


def _simulate_short_rates(
    r0: float,
    a: float,
    sigma: float,
    theta: np.ndarray,
    dt: float,
    num_steps: int,
    num_paths: int,
    device: torch.device,
) -> torch.Tensor:
    """Simulate Hull-White short rate paths.

    Returns:
        Tensor of shape (num_paths, num_steps + 1) with short rate paths.
    """
    # Generate random increments
    if device.type == "mps":
        z = torch.randn(num_paths, num_steps, dtype=torch.float32).to(device)
    else:
        z = torch.randn(num_paths, num_steps, dtype=torch.float32, device=device)

    theta_t = torch.tensor(theta, dtype=torch.float32, device=device)
    sqrt_dt = float(np.sqrt(dt))

    # Initialize rate paths
    rates = torch.zeros(num_paths, num_steps + 1, dtype=torch.float32, device=device)
    rates[:, 0] = r0

    # Euler-Maruyama discretisation
    for t in range(num_steps):
        r_t = rates[:, t]
        dr = (theta_t[t] - a * r_t) * dt + sigma * sqrt_dt * z[:, t]
        rates[:, t + 1] = r_t + dr

    return rates


def _price_swaption(
    rates: torch.Tensor,
    dt: float,
    option_expiry_steps: int,
    swap_tenor_steps: int,
    fixed_rate: float,
    notional: float,
    device: torch.device,
) -> dict[str, float]:
    """Price a European payer swaption from simulated short rate paths.

    A payer swaption gives the right to enter a swap paying fixed, receiving floating.
    Payoff at expiry = Notional * max(swap_value, 0)

    swap_value ~ sum over swap periods of [floating_rate - fixed_rate] * dt * discount
    """
    num_paths = rates.shape[0]

    # Discount factors: D(0, T) = exp(-sum(r(t)*dt) from 0 to T)
    # Cumulative rate integral
    cum_rates = torch.cumsum(rates[:, :option_expiry_steps + swap_tenor_steps + 1] * dt, dim=1)

    # Discount from time 0 to option expiry
    df_to_expiry = torch.exp(-cum_rates[:, option_expiry_steps])

    # At option expiry, compute the swap value
    # Swap pays: sum over periods from expiry to expiry+swap_tenor of
    #   (r(t) - fixed_rate) * dt * D(expiry, t)
    swap_values = torch.zeros(num_paths, dtype=torch.float32, device=device)

    for t in range(option_expiry_steps, option_expiry_steps + swap_tenor_steps):
        if t + 1 >= rates.shape[1]:
            break
        # Forward discount from expiry to time t
        df_expiry_to_t = torch.exp(-(cum_rates[:, t] - cum_rates[:, option_expiry_steps]))
        # Floating rate at time t is the simulated short rate
        floating_rate = rates[:, t]
        # Period cash flow
        swap_values += (floating_rate - fixed_rate) * dt * df_expiry_to_t

    # Swaption payoff = max(swap_value, 0) * notional
    payoff = torch.clamp(swap_values, min=0.0) * notional

    # Present value: discount payoff from expiry to time 0
    pv = payoff * df_to_expiry

    price = float(pv.mean().item())
    std_err = float(pv.std().item() / np.sqrt(num_paths))

    return {"price": price, "std_error": std_err}


# ---------------------------------------------------------------------------
# Main pricing function
# ---------------------------------------------------------------------------


async def price_swaption(
    curve_points: list[dict[str, float]] | None = None,
    r0: float | None = None,
    a: float = 0.03,
    sigma: float = 0.01,
    option_expiry: float = 1.0,
    swap_tenor: float = 5.0,
    fixed_rate: float | None = None,
    notional: float = 10_000_000,
    num_paths: int = 50_000,
) -> dict[str, Any]:
    """Price a European payer swaption using Hull-White Monte Carlo.

    Args:
        curve_points: Initial term structure [{"maturity": float, "yield": float}]
        r0: Initial short rate (if None, taken from curve_points)
        a: Mean reversion speed (default 0.03)
        sigma: Short rate volatility (default 0.01 = 100bps)
        option_expiry: Swaption expiry in years (default 1Y)
        swap_tenor: Underlying swap tenor in years (default 5Y)
        fixed_rate: Strike rate (if None, ATM = r0)
        notional: Notional amount (default $10M)
        num_paths: Number of Monte Carlo paths
    """
    try:
        device = _get_device()
        logger.info("Hull-White swaption pricer using device: %s", device)
        t_start = time.perf_counter()

        # Default curve if none provided
        if curve_points is None or len(curve_points) < 2:
            curve_points = [
                {"maturity": 0.25, "yield": 4.50},
                {"maturity": 2.0, "yield": 4.20},
                {"maturity": 5.0, "yield": 4.10},
                {"maturity": 10.0, "yield": 4.25},
                {"maturity": 30.0, "yield": 4.50},
            ]

        # Initial short rate
        if r0 is None:
            r0 = curve_points[0]["yield"] / 100.0  # Convert % to decimal

        # ATM fixed rate
        if fixed_rate is None:
            # Use the yield at the swap tenor point as ATM rate
            swap_point = [p for p in curve_points if p["maturity"] >= swap_tenor]
            if swap_point:
                fixed_rate = swap_point[0]["yield"] / 100.0
            else:
                fixed_rate = r0

        # Simulation parameters
        total_time = option_expiry + swap_tenor
        dt = 1 / 252  # Daily steps
        num_steps = int(total_time / dt)
        option_expiry_steps = int(option_expiry / dt)
        swap_tenor_steps = int(swap_tenor / dt)

        # Cap steps for performance
        if num_steps > 3000:
            dt = total_time / 3000
            num_steps = 3000
            option_expiry_steps = int(option_expiry / dt)
            swap_tenor_steps = int(swap_tenor / dt)

        logger.info(
            "HW params — r0=%.4f a=%.4f sigma=%.4f K=%.4f T_opt=%.1f T_swap=%.1f paths=%d steps=%d",
            r0, a, sigma, fixed_rate, option_expiry, swap_tenor, num_paths, num_steps,
        )

        # Calibrate theta to term structure
        theta = _calibrate_theta(r0, a, sigma, curve_points, dt, num_steps)

        # Simulate short rate paths
        rates = _simulate_short_rates(r0, a, sigma, theta, dt, num_steps, num_paths, device)

        # Price swaption
        result = _price_swaption(
            rates, dt, option_expiry_steps, swap_tenor_steps, fixed_rate, notional, device,
        )

        t_end = time.perf_counter()
        computation_time_ms = round((t_end - t_start) * 1000, 2)

        # Extract sample paths for visualisation (5 paths, downsampled)
        sample_indices = torch.linspace(0, num_paths - 1, 5).long()
        sample_rates = rates[sample_indices].cpu()

        # Downsample to ~100 points for charting
        step_size = max(1, num_steps // 100)
        sample_paths = []
        for path in sample_rates:
            downsampled = path[::step_size].tolist()
            sample_paths.append([round(r * 100, 4) for r in downsampled])  # Convert to %

        # Rate distribution at expiry
        rates_at_expiry = rates[:, option_expiry_steps].cpu().numpy() * 100  # To %
        rate_hist, bin_edges = np.histogram(rates_at_expiry, bins=30)
        rate_distribution = {
            "bins": [round(float(b), 4) for b in bin_edges[:-1]],
            "counts": [int(c) for c in rate_hist],
            "mean": round(float(rates_at_expiry.mean()), 4),
            "std": round(float(rates_at_expiry.std()), 4),
            "percentile_5": round(float(np.percentile(rates_at_expiry, 5)), 4),
            "percentile_95": round(float(np.percentile(rates_at_expiry, 95)), 4),
        }

        # Greeks approximation via bump-and-reprice
        # Delta (rate sensitivity)
        bump = 0.0001  # 1 bps
        rates_up = rates.clone()
        rates_up[:, 0] += bump
        result_up = _price_swaption(rates_up, dt, option_expiry_steps, swap_tenor_steps, fixed_rate, notional, device)
        delta_01 = (result_up["price"] - result["price"]) / (bump * 10000)  # Per basis point

        logger.info(
            "Hull-White swaption — price=$%.2f  SE=$%.2f  delta01=$%.2f  time=%.1fms  device=%s",
            result["price"], result["std_error"], delta_01, computation_time_ms, device.type,
        )

        return {
            "status": "ok",
            "swaption_price": round(result["price"], 2),
            "swaption_price_bps": round(result["price"] / notional * 10000, 2),
            "standard_error": round(result["std_error"], 2),
            "delta_01": round(delta_01, 2),
            "params": {
                "r0_pct": round(r0 * 100, 4),
                "mean_reversion": a,
                "volatility": sigma,
                "fixed_rate_pct": round(fixed_rate * 100, 4),
                "option_expiry": option_expiry,
                "swap_tenor": swap_tenor,
                "notional": notional,
            },
            "num_paths": num_paths,
            "num_steps": num_steps,
            "device_used": device.type,
            "computation_time_ms": computation_time_ms,
            "sample_paths": sample_paths,
            "rate_distribution": rate_distribution,
        }

    except Exception as exc:
        logger.exception("Hull-White swaption pricing failed")
        raise RuntimeError(f"Hull-White pricing failed: {exc}") from exc
