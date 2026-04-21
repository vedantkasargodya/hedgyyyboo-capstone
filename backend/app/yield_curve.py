"""
Hedgyyyboo Phase 5 — Nelson-Siegel-Svensson Yield Curve Fitting & PCA.

Fits the NSS model to live Treasury yields using scipy.optimize,
performs PCA on historical yield changes (level/slope/curvature),
and generates a full fitted curve + forward rates.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from scipy.optimize import least_squares

logger = logging.getLogger("hedgyyyboo.yield_curve")


# ---------------------------------------------------------------------------
# Nelson-Siegel-Svensson Model
# ---------------------------------------------------------------------------
# y(t) = b0 + b1*((1-exp(-t/tau1))/(t/tau1))
#            + b2*((1-exp(-t/tau1))/(t/tau1) - exp(-t/tau1))
#            + b3*((1-exp(-t/tau2))/(t/tau2) - exp(-t/tau2))


def _nss_yield(t: np.ndarray, params: np.ndarray) -> np.ndarray:
    """Compute NSS model yields for given maturities.

    Parameters: [b0, b1, b2, b3, tau1, tau2]
    """
    b0, b1, b2, b3, tau1, tau2 = params

    # Prevent division by zero
    tau1 = max(tau1, 0.01)
    tau2 = max(tau2, 0.01)

    x1 = t / tau1
    x2 = t / tau2

    # Avoid overflow in exp
    x1 = np.clip(x1, -500, 500)
    x2 = np.clip(x2, -500, 500)

    term1 = np.where(x1 < 1e-6, 1.0, (1 - np.exp(-x1)) / x1)
    term2 = term1 - np.exp(-x1)
    term3 = np.where(x2 < 1e-6, 1.0, (1 - np.exp(-x2)) / x2) - np.exp(-x2)

    return b0 + b1 * term1 + b2 * term2 + b3 * term3


def _nss_residuals(params: np.ndarray, maturities: np.ndarray, yields: np.ndarray) -> np.ndarray:
    """Compute residuals for least-squares fitting."""
    model_yields = _nss_yield(maturities, params)
    return model_yields - yields


def fit_nss(curve_points: list[dict[str, float]]) -> dict[str, Any]:
    """Fit NSS model to observed yield curve points.

    Args:
        curve_points: list of {"maturity": float, "yield": float}

    Returns:
        dict with fitted parameters, fitted curve, and diagnostics
    """
    if len(curve_points) < 3:
        raise ValueError("Need at least 3 yield points for NSS fitting")

    maturities = np.array([p["maturity"] for p in curve_points])
    yields_obs = np.array([p["yield"] for p in curve_points])

    # Initial guess: b0=long rate, b1=slope, b2=curvature, b3=0, tau1=1.5, tau2=5
    b0_init = yields_obs[-1]  # Long-end yield
    b1_init = yields_obs[0] - yields_obs[-1]  # Short minus long
    x0 = np.array([b0_init, b1_init, 0.0, 0.0, 1.5, 5.0])

    # Bounds
    lower = [0.0, -20.0, -20.0, -20.0, 0.01, 0.01]
    upper = [20.0, 20.0, 20.0, 20.0, 50.0, 50.0]

    try:
        result = least_squares(
            _nss_residuals,
            x0,
            args=(maturities, yields_obs),
            bounds=(lower, upper),
            method="trf",
            max_nfev=1000,
        )

        params = result.x
        residuals = result.fun
        rmse = float(np.sqrt(np.mean(residuals ** 2)))

        # Generate fitted curve at fine granularity
        fitted_maturities = np.linspace(0.25, 30, 120)
        fitted_yields = _nss_yield(fitted_maturities, params)

        # Generate forward rate curve: f(t) = -d/dt[t*y(t)] / dt
        # Approximation: f(t) = y(t) + t * dy/dt
        dt = 0.01
        y_t = _nss_yield(fitted_maturities, params)
        y_t_dt = _nss_yield(fitted_maturities + dt, params)
        forward_rates = y_t + fitted_maturities * (y_t_dt - y_t) / dt

        fitted_curve = [
            {
                "maturity": round(float(m), 2),
                "fitted_yield": round(float(y), 4),
                "forward_rate": round(float(f), 4),
            }
            for m, y, f in zip(fitted_maturities, fitted_yields, forward_rates)
        ]

        # Extract economic interpretation
        b0, b1, b2, b3, tau1, tau2 = params
        interpretation = {
            "long_term_rate": round(float(b0), 4),
            "slope_factor": round(float(b1), 4),
            "curvature_factor": round(float(b2), 4),
            "second_hump": round(float(b3), 4),
            "decay_1": round(float(tau1), 4),
            "decay_2": round(float(tau2), 4),
            "curve_shape": _classify_curve_shape(b1, b2),
        }

        # Observed vs fitted comparison
        observed_vs_fitted = []
        for i, pt in enumerate(curve_points):
            fitted_val = float(_nss_yield(np.array([pt["maturity"]]), params)[0])
            observed_vs_fitted.append({
                "maturity": pt["maturity"],
                "observed": pt["yield"],
                "fitted": round(fitted_val, 4),
                "residual": round(pt["yield"] - fitted_val, 4),
            })

        logger.info(
            "NSS fit — RMSE=%.4f bps, b0=%.3f b1=%.3f b2=%.3f shape=%s",
            rmse * 100, b0, b1, b2, interpretation["curve_shape"],
        )

        return {
            "status": "ok",
            "parameters": {
                "b0": round(float(b0), 6),
                "b1": round(float(b1), 6),
                "b2": round(float(b2), 6),
                "b3": round(float(b3), 6),
                "tau1": round(float(tau1), 6),
                "tau2": round(float(tau2), 6),
            },
            "rmse_pct": round(rmse, 6),
            "fitted_curve": fitted_curve,
            "observed_vs_fitted": observed_vs_fitted,
            "interpretation": interpretation,
            "num_observations": len(curve_points),
        }

    except Exception as exc:
        logger.exception("NSS fitting failed")
        raise ValueError(f"NSS fitting failed: {exc}")


def _classify_curve_shape(b1: float, b2: float) -> str:
    """Classify the yield curve shape from NSS parameters."""
    if b1 < -0.5:
        return "NORMAL (steep)"
    elif b1 < 0:
        return "NORMAL (flat)"
    elif b1 < 0.5:
        return "FLAT"
    elif b2 > 1.0:
        return "HUMPED"
    else:
        return "INVERTED"


# ---------------------------------------------------------------------------
# Yield Curve PCA (Level / Slope / Curvature decomposition)
# ---------------------------------------------------------------------------


def yield_curve_pca(history: dict[str, list[dict]]) -> dict[str, Any]:
    """Perform PCA on historical yield changes to decompose
    into Level, Slope, and Curvature factors.

    Args:
        history: dict of tenor -> [{"date": str, "yield": float}, ...]
    """
    # Build a DataFrame of yields across tenors
    tenors = sorted(history.keys(), key=lambda t: _tenor_to_years(t))

    if len(tenors) < 2:
        return {"status": "insufficient_data", "message": "Need at least 2 tenors for PCA"}

    # Align dates across tenors
    all_dates: set[str] = set()
    for tenor in tenors:
        dates = {pt["date"] for pt in history[tenor]}
        if not all_dates:
            all_dates = dates
        else:
            all_dates &= dates

    if len(all_dates) < 20:
        return {"status": "insufficient_data", "message": f"Only {len(all_dates)} common dates — need at least 20"}

    sorted_dates = sorted(all_dates)

    # Build matrix
    yield_matrix = np.zeros((len(sorted_dates), len(tenors)))
    for j, tenor in enumerate(tenors):
        date_yield = {pt["date"]: pt["yield"] for pt in history[tenor]}
        for i, date in enumerate(sorted_dates):
            yield_matrix[i, j] = date_yield.get(date, np.nan)

    # Compute daily changes
    changes = np.diff(yield_matrix, axis=0)

    # Remove rows with NaN
    mask = ~np.any(np.isnan(changes), axis=1)
    changes = changes[mask]

    if len(changes) < 10:
        return {"status": "insufficient_data", "message": "Not enough clean yield change data"}

    # Standardise
    mean_changes = changes.mean(axis=0)
    std_changes = changes.std(axis=0)
    std_changes[std_changes == 0] = 1  # Prevent division by zero
    standardised = (changes - mean_changes) / std_changes

    # PCA via SVD
    U, S, Vt = np.linalg.svd(standardised, full_matrices=False)

    # Explained variance
    explained_var = (S ** 2) / (S ** 2).sum()

    # The first 3 PCs typically map to: Level, Slope, Curvature
    components = []
    factor_names = ["LEVEL", "SLOPE", "CURVATURE"]
    for i in range(min(3, len(S))):
        loadings = {tenors[j]: round(float(Vt[i, j]), 4) for j in range(len(tenors))}
        components.append({
            "factor": factor_names[i] if i < 3 else f"PC{i+1}",
            "explained_variance_pct": round(float(explained_var[i]) * 100, 2),
            "loadings": loadings,
        })

    total_explained = round(float(explained_var[:3].sum()) * 100, 2) if len(explained_var) >= 3 else round(float(explained_var.sum()) * 100, 2)

    logger.info("Yield curve PCA — PC1=%.1f%% PC2=%.1f%% PC3=%.1f%%",
                explained_var[0] * 100 if len(explained_var) > 0 else 0,
                explained_var[1] * 100 if len(explained_var) > 1 else 0,
                explained_var[2] * 100 if len(explained_var) > 2 else 0)

    return {
        "status": "ok",
        "components": components,
        "total_explained_pct": total_explained,
        "num_observations": len(changes),
        "tenors_used": tenors,
    }


def _tenor_to_years(tenor: str) -> float:
    """Convert tenor string to years."""
    mapping = {"3M": 0.25, "1Y": 1, "2Y": 2, "5Y": 5, "10Y": 10, "30Y": 30}
    return mapping.get(tenor, 0)
