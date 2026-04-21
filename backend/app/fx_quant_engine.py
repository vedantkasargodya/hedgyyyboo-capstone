"""
Hedgyyyboo Phase 6 — PhD-Level FX Quant Engine.

1. Ornstein-Uhlenbeck (OU) Mean Reversion via MLE
   - Fits OU process to FX pair log-prices
   - Outputs exact half-life of mean reversion

2. Rough Volatility (Hurst Exponent + fBM simulation)
   - Computes Hurst exponent H on realised vol series
   - H < 0.5 confirms rough vol → uses fBM for forward simulation

3. Neural SDEs via torchsde
   - Learns continuous drift and diffusion functions from live data
   - Runs on MPS/CUDA/CPU
"""

from __future__ import annotations

import logging
import time
from typing import Any

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger("hedgyyyboo.fx_quant_engine")


# ===========================================================================
# 1. ORNSTEIN-UHLENBECK MLE
# ===========================================================================


def fit_ou_mle(prices: np.ndarray, dt: float = 1 / 252) -> dict[str, Any]:
    """Fit Ornstein-Uhlenbeck process via Maximum Likelihood Estimation.

    The OU SDE: dX(t) = kappa * (mu - X(t)) dt + sigma * dW(t)

    MLE closed-form for discrete observations:
      X_{n+1} = a + b * X_n + eps,  eps ~ N(0, sigma_eps^2)
    where b = exp(-kappa * dt), a = mu * (1 - b)

    Parameters
    ----------
    prices : array of log-prices or spreads
    dt : time step (1/252 for daily)

    Returns
    -------
    dict with kappa, mu, sigma, half_life, and diagnostics
    """
    n = len(prices)
    if n < 20:
        raise ValueError("Need at least 20 observations for OU MLE")

    x = prices[:-1]
    y = prices[1:]

    # OLS regression: y = a + b*x
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    sxx = np.sum((x - x_mean) ** 2)
    sxy = np.sum((x - x_mean) * (y - y_mean))

    b_hat = sxy / sxx if sxx > 0 else 0.999
    a_hat = y_mean - b_hat * x_mean

    # Residual variance
    residuals = y - (a_hat + b_hat * x)
    sigma_eps_sq = np.mean(residuals ** 2)

    # Convert to continuous OU parameters
    if b_hat <= 0 or b_hat >= 1:
        # Process is not mean-reverting
        return {
            "status": "not_mean_reverting",
            "kappa": 0.0,
            "mu": float(np.mean(prices)),
            "sigma": float(np.std(np.diff(prices)) / np.sqrt(dt)),
            "half_life_days": float("inf"),
            "b_hat": float(b_hat),
            "is_mean_reverting": False,
        }

    kappa = -np.log(b_hat) / dt
    mu = a_hat / (1 - b_hat)
    sigma_sq = 2 * kappa * sigma_eps_sq / (1 - b_hat ** 2)
    sigma = np.sqrt(max(sigma_sq, 1e-12))

    # Half-life of mean reversion
    half_life = np.log(2) / kappa  # in units of dt
    half_life_days = half_life * 252  # Convert to trading days

    # Stationarity test: b_hat should be significantly < 1
    se_b = np.sqrt(sigma_eps_sq / sxx)
    t_stat = (b_hat - 1) / se_b if se_b > 0 else 0

    logger.info(
        "OU MLE — kappa=%.4f mu=%.6f sigma=%.6f half_life=%.1f days t_stat=%.2f",
        kappa, mu, sigma, half_life_days, t_stat,
    )

    return {
        "status": "ok",
        "kappa": round(float(kappa), 6),
        "mu": round(float(mu), 6),
        "sigma": round(float(sigma), 6),
        "half_life_days": round(float(half_life_days), 2),
        "b_hat": round(float(b_hat), 6),
        "a_hat": round(float(a_hat), 6),
        "t_stat": round(float(t_stat), 2),
        "is_mean_reverting": bool(t_stat < -1.96),
        "num_observations": n,
    }


# ===========================================================================
# 2. HURST EXPONENT & ROUGH VOLATILITY
# ===========================================================================


def compute_hurst_exponent(vol_series: list[float] | np.ndarray) -> dict[str, Any]:
    """Compute the Hurst exponent on a volatility time series.

    H < 0.5: Rough / anti-persistent (mean-reverting vol)
    H = 0.5: Random walk
    H > 0.5: Persistent / trending

    Uses R/S (Rescaled Range) analysis.
    """
    from hurst import compute_Hc

    series = np.array(vol_series)
    if len(series) < 30:
        raise ValueError("Need at least 30 observations for Hurst estimation")

    # Remove NaN/Inf
    series = series[np.isfinite(series)]
    if len(series) < 30:
        raise ValueError("Too many NaN/Inf values in vol series")

    H, c, data = compute_Hc(series, kind="price", simplified=True)

    is_rough = H < 0.5
    roughness_label = "ROUGH" if H < 0.4 else "MILDLY ROUGH" if H < 0.5 else "SMOOTH" if H > 0.6 else "RANDOM WALK"

    logger.info("Hurst exponent: H=%.4f (%s)", H, roughness_label)

    return {
        "status": "ok",
        "hurst_exponent": round(float(H), 6),
        "c_constant": round(float(c), 6),
        "is_rough": bool(is_rough),
        "roughness_label": roughness_label,
        "series_length": len(series),
        "interpretation": (
            f"H={H:.4f} — volatility is {'rough (anti-persistent)' if is_rough else 'smooth (persistent)'}, "
            f"{'consistent with rBergomi-type models' if is_rough else 'standard GBM may suffice'}"
        ),
    }


def simulate_fbm_paths(
    H: float,
    n_paths: int = 1000,
    n_steps: int = 63,
    dt: float = 1 / 252,
    sigma_0: float = 0.10,
) -> dict[str, Any]:
    """Simulate fractional Brownian motion paths for rough vol modelling.

    Uses the Cholesky decomposition method for exact fBM generation.
    """
    t_start = time.perf_counter()

    # Build covariance matrix for fBM
    # Cov(B^H_s, B^H_t) = 0.5 * (|s|^{2H} + |t|^{2H} - |t-s|^{2H})
    times = np.arange(1, n_steps + 1) * dt
    n = len(times)

    cov_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            s, t = times[i], times[j]
            cov_matrix[i, j] = 0.5 * (
                abs(s) ** (2 * H) + abs(t) ** (2 * H) - abs(t - s) ** (2 * H)
            )

    # Cholesky decomposition
    try:
        L = np.linalg.cholesky(cov_matrix + 1e-10 * np.eye(n))
    except np.linalg.LinAlgError:
        # Fallback: use eigendecomposition
        eigvals, eigvecs = np.linalg.eigh(cov_matrix)
        eigvals = np.maximum(eigvals, 1e-10)
        L = eigvecs @ np.diag(np.sqrt(eigvals))

    # Generate paths
    Z = np.random.randn(n_paths, n)
    fbm_paths = Z @ L.T  # (n_paths, n_steps)

    # Vol paths: sigma(t) = sigma_0 * exp(eta * W^H_t - 0.5 * eta^2 * t^{2H})
    eta = 1.0  # Vol-of-vol parameter
    vol_paths = np.zeros((n_paths, n_steps + 1))
    vol_paths[:, 0] = sigma_0

    for i in range(n_steps):
        t = times[i]
        vol_paths[:, i + 1] = sigma_0 * np.exp(
            eta * fbm_paths[:, i] - 0.5 * eta ** 2 * t ** (2 * H)
        )

    t_end = time.perf_counter()
    computation_ms = round((t_end - t_start) * 1000, 2)

    # Summary statistics
    terminal_vols = vol_paths[:, -1]
    sample_indices = np.linspace(0, n_paths - 1, 5).astype(int)
    sample_paths = [
        [round(float(v), 6) for v in vol_paths[idx]]
        for idx in sample_indices
    ]

    return {
        "status": "ok",
        "hurst_used": round(H, 4),
        "n_paths": n_paths,
        "n_steps": n_steps,
        "sigma_0": sigma_0,
        "terminal_vol_mean": round(float(np.mean(terminal_vols)), 6),
        "terminal_vol_std": round(float(np.std(terminal_vols)), 6),
        "terminal_vol_p5": round(float(np.percentile(terminal_vols, 5)), 6),
        "terminal_vol_p95": round(float(np.percentile(terminal_vols, 95)), 6),
        "sample_paths": sample_paths,
        "computation_time_ms": computation_ms,
    }


# ===========================================================================
# 3. NEURAL SDE (torchsde)
# ===========================================================================


def _get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class NeuralDrift(nn.Module):
    """Neural network parameterising the drift function f(t, X)."""

    def __init__(self, hidden_dim: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, hidden_dim),  # (t, X) -> hidden
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, t_x: torch.Tensor) -> torch.Tensor:
        return self.net(t_x)


class NeuralDiffusion(nn.Module):
    """Neural network parameterising the diffusion function g(t, X)."""

    def __init__(self, hidden_dim: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
            nn.Softplus(),  # Ensure positive diffusion
        )

    def forward(self, t_x: torch.Tensor) -> torch.Tensor:
        return self.net(t_x)


class FXNeuralSDE(nn.Module):
    """Neural SDE for FX pair dynamics.

    dX(t) = f_theta(t, X) dt + g_phi(t, X) dW(t)

    Uses torchsde for forward simulation and adjoint-based backprop.
    """
    sde_type = "ito"
    noise_type = "diagonal"

    def __init__(self, hidden_dim: int = 32):
        super().__init__()
        self.drift_net = NeuralDrift(hidden_dim)
        self.diffusion_net = NeuralDiffusion(hidden_dim // 2)

    def f(self, t: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
        """Drift function."""
        t_expanded = t.expand(y.shape[0], 1)
        t_x = torch.cat([t_expanded, y], dim=1)
        return self.drift_net(t_x)

    def g(self, t: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
        """Diffusion function."""
        t_expanded = t.expand(y.shape[0], 1)
        t_x = torch.cat([t_expanded, y], dim=1)
        return self.diffusion_net(t_x)


async def train_neural_sde(
    prices: np.ndarray,
    n_epochs: int = 100,
    lr: float = 0.005,
    dt: float = 1 / 252,
) -> dict[str, Any]:
    """Train Neural SDE on FX price data and extract learned drift/diffusion.

    Parameters
    ----------
    prices : array of close prices
    n_epochs : training epochs
    lr : learning rate
    dt : time step

    Returns
    -------
    dict with learned drift at current state, diffusion, and sample forward paths
    """
    import torchsde

    device = _get_device()
    # Neural SDE training on MPS can be unstable, fall back to CPU
    if device.type == "mps":
        train_device = torch.device("cpu")
    else:
        train_device = device

    logger.info("Neural SDE training on %s (sim will use %s)", train_device, device)
    t_start = time.perf_counter()

    # Prepare data: normalise log-prices
    log_prices = np.log(prices)
    mean_lp = float(np.mean(log_prices))
    std_lp = float(np.std(log_prices))
    if std_lp < 1e-8:
        std_lp = 1.0

    normalised = (log_prices - mean_lp) / std_lp

    # Create observation pairs
    n = len(normalised)
    obs = torch.tensor(normalised, dtype=torch.float32, device=train_device).unsqueeze(1)  # (n, 1)
    ts = torch.linspace(0, (n - 1) * dt, n, device=train_device)

    # Model
    model = FXNeuralSDE(hidden_dim=32).to(train_device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    # Training: minimize MSE between simulated and observed paths
    # We use windows of length K for tractable training
    K = min(20, n - 1)  # Window length
    losses = []

    for epoch in range(n_epochs):
        optimizer.zero_grad()

        # Random starting points
        start_idx = np.random.randint(0, n - K)
        y0 = obs[start_idx].unsqueeze(0)  # (1, 1)
        t_span = ts[start_idx:start_idx + K + 1] - ts[start_idx]
        target = obs[start_idx:start_idx + K + 1].unsqueeze(0)  # (1, K+1, 1)

        # Forward simulate
        try:
            y_pred = torchsde.sdeint(model, y0, t_span, method="euler", dt=dt)
            # y_pred: (K+1, 1, 1)
            y_pred = y_pred.permute(1, 0, 2)  # (1, K+1, 1)

            loss = torch.mean((y_pred - target) ** 2)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            losses.append(float(loss.item()))
        except Exception as exc:
            if epoch == 0:
                logger.warning("Neural SDE training step failed: %s", exc)
            continue

    t_end = time.perf_counter()
    training_time_ms = round((t_end - t_start) * 1000, 2)

    # Extract learned drift at current state
    current_state = obs[-1].unsqueeze(0)  # (1, 1)
    t_now = torch.tensor([0.0], device=train_device)
    with torch.no_grad():
        learned_drift = float(model.f(t_now, current_state).item())
        learned_diffusion = float(model.g(t_now, current_state).item())

    # De-normalise drift to get directional signal
    # drift in real space ≈ drift * std_lp * price
    current_price = float(prices[-1])
    real_drift = learned_drift * std_lp
    drift_direction = "BULLISH" if real_drift > 0.001 else "BEARISH" if real_drift < -0.001 else "NEUTRAL"

    # Generate forward simulation paths
    model.eval()
    n_sim_steps = 63  # 3 months forward
    sim_t = torch.linspace(0, n_sim_steps * dt, n_sim_steps + 1, device=train_device)
    y0_sim = current_state.repeat(5, 1)  # 5 sample paths

    try:
        with torch.no_grad():
            sim_paths = torchsde.sdeint(model, y0_sim, sim_t, method="euler", dt=dt)
            # sim_paths: (n_sim_steps+1, 5, 1)
            sim_np = sim_paths.squeeze(-1).T.cpu().numpy()  # (5, n_sim_steps+1)
            # De-normalise
            sim_prices = np.exp(sim_np * std_lp + mean_lp)
            sample_forward_paths = [
                [round(float(p), 5) for p in path]
                for path in sim_prices
            ]
    except Exception:
        sample_forward_paths = []

    final_loss = losses[-1] if losses else float("inf")

    logger.info(
        "Neural SDE — drift=%.6f diffusion=%.6f direction=%s loss=%.6f time=%.0fms device=%s",
        learned_drift, learned_diffusion, drift_direction, final_loss, training_time_ms, train_device,
    )

    return {
        "status": "ok",
        "learned_drift": round(learned_drift, 6),
        "learned_diffusion": round(learned_diffusion, 6),
        "real_drift": round(real_drift, 6),
        "drift_direction": drift_direction,
        "current_price": round(current_price, 5),
        "final_loss": round(final_loss, 6),
        "n_epochs": n_epochs,
        "training_time_ms": training_time_ms,
        "device_used": str(train_device),
        "sample_forward_paths": sample_forward_paths,
        "loss_curve": [round(l, 6) for l in losses[::max(1, len(losses) // 20)]],
    }
