"""
Hedgyyyboo ML trade-screener.

Reads every CLOSED paper_trades row, extracts a fixed-length feature vector
from the signal_packet persisted at open time, and fits an XGBoost binary
classifier that predicts whether a trade with similar signals will close
PROFITABLE (realised pnl_pct > 0).

The model is deliberately light.  With <50 closed trades we refuse to
train — overfit risk dominates any signal we could extract.  Status is
reported as ``not_ready`` in that regime and the /analytics page shows a
"collecting data" badge.

Once trained, the Auto-PM can call score(signal_packet) to get a
win-probability in [0, 1].  We plug it as an additional gate before the
LLM call, skipping Gemma entirely when p_win < 0.5.  That keeps the
free-tier quota for actually-promising candidates.
"""
from __future__ import annotations

import json
import logging
import math
import os
import pickle
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.paper_trades_model import list_trades

logger = logging.getLogger("hedgyyyboo.ml_model")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model_artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "trade_screener.pkl")
STATUS_PATH = os.path.join(MODEL_DIR, "trade_screener_status.json")

MIN_TRADES_TO_TRAIN = 50          # hard floor to avoid fitting noise
MIN_TRADES_FOR_AUC  = 30          # below this, skip the val-set metric


# ---------------------------------------------------------------------------
# Feature extraction — deterministic, order-stable
# ---------------------------------------------------------------------------

FEATURE_NAMES = [
    # price block
    "ret_1d_pct", "ret_5d_pct", "ret_20d_pct",
    "range_position_pct", "realised_vol_20d_ann",
    # OU MLE (FX/EQUITY)
    "ou_kappa", "ou_theta_dev", "ou_sigma", "ou_half_life",
    "ou_t_stat", "ou_current_dev_sigmas", "ou_is_mean_reverting",
    # Hurst
    "hurst", "hurst_is_trending",
    # GARCH
    "garch_alpha", "garch_beta", "garch_persistence",
    "garch_forecast_vol_pct", "garch_var_1pct_pct",
    # Rates-specific (zero for other desks)
    "slope_10y_3m_bps", "slope_10y_5y_bps", "curvature_bps",
    # Desk one-hot
    "desk_fx", "desk_equity", "desk_rates",
    # Direction (LONG=1, SHORT=0)
    "direction_long",
]


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        f = float(v)
        return f if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def extract_features(packet: dict[str, Any], direction: str | None = None) -> np.ndarray:
    """Flatten a signal_packet (from signal_packet.py) into a vector of
    len(FEATURE_NAMES).  Missing nested dicts → zeros, mean-reverting bool
    → {0,1}, desk one-hot encoded."""
    p = packet or {}
    price = p.get("price") or {}
    ou    = p.get("ou_mle") or {}
    hurst = p.get("hurst") or {}
    garch = p.get("garch") or {}
    desk  = (p.get("desk") or "").upper()

    # OU: theta_dev = current price's deviation from theta in log-space,
    # but when we store log(theta) and current price separately the
    # easiest proxy is current_dev_sigmas which we already expose.
    ou_current_dev = _safe_float(ou.get("current_dev_sigmas"))
    ou_is_mr = 1.0 if ou.get("is_mean_reverting") else 0.0

    hurst_val = _safe_float(hurst.get("hurst"))
    hurst_trending = 1.0 if hurst.get("regime") == "TRENDING" else 0.0

    return np.array([
        _safe_float(price.get("ret_1d_pct")),
        _safe_float(price.get("ret_5d_pct")),
        _safe_float(price.get("ret_20d_pct")),
        _safe_float(price.get("range_position_pct")),
        _safe_float(price.get("realised_vol_20d_ann")),

        _safe_float(ou.get("kappa")),
        _safe_float(ou.get("theta")),
        _safe_float(ou.get("sigma")),
        _safe_float(ou.get("half_life_days")),
        _safe_float(ou.get("t_stat")),
        ou_current_dev,
        ou_is_mr,

        hurst_val,
        hurst_trending,

        _safe_float(garch.get("alpha")),
        _safe_float(garch.get("beta")),
        _safe_float(garch.get("persistence")),
        _safe_float(garch.get("forecast_daily_vol_pct")),
        _safe_float(garch.get("var_1pct_daily_pct")),

        _safe_float(p.get("slope_10y_3m_bps")),
        _safe_float(p.get("slope_10y_5y_bps")),
        _safe_float(p.get("curvature_bps")),

        1.0 if desk == "FX"     else 0.0,
        1.0 if desk == "EQUITY" else 0.0,
        1.0 if desk == "RATES"  else 0.0,

        1.0 if (direction or "").upper() == "LONG" else 0.0,
    ], dtype=np.float64)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def _build_training_set() -> tuple[np.ndarray, np.ndarray, list[dict[str, Any]]]:
    """Pull every CLOSED trade with a signal_packet (live paper trades +
    historical backfilled samples) → (X, y, raw)."""
    closed = list_trades(status="CLOSED", limit=5000)

    # Merge in historical synthetic samples if the table exists.
    try:
        from app.historical_backfill import load_samples_as_training_rows
        closed = closed + load_samples_as_training_rows()
    except Exception as exc:
        logger.debug("historical backfill not available yet: %s", exc)

    X, y, raw = [], [], []
    for t in closed:
        meta = t.get("meta") or {}
        packet = meta.get("signal_packet") if isinstance(meta, dict) else None
        if not packet:
            continue
        pnl = t.get("pnl_pct")
        if pnl is None:
            continue
        X.append(extract_features(packet, direction=t.get("direction")))
        y.append(1 if float(pnl) > 0 else 0)
        raw.append(t)
    if not X:
        return np.zeros((0, len(FEATURE_NAMES))), np.zeros(0), []
    return np.vstack(X), np.asarray(y), raw


def _save_status(doc: dict[str, Any]) -> None:
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(STATUS_PATH, "w") as f:
        json.dump(doc, f, indent=2)


def training_status() -> dict[str, Any]:
    """Return what the analytics page needs to show the ML card."""
    try:
        X, y, _ = _build_training_set()
    except Exception as exc:
        return {"ready": False, "reason": f"build_training_set_failed: {exc}"}

    base: dict[str, Any] = {
        "trades_with_signal_packet": int(len(X)),
        "trades_min_required": MIN_TRADES_TO_TRAIN,
        "positive_class_rate": float(y.mean()) if len(y) else 0.0,
        "ready": False,
    }

    # Overlay any artifact status from the last successful training.
    if os.path.exists(STATUS_PATH):
        try:
            with open(STATUS_PATH) as f:
                base.update(json.load(f))
        except Exception:
            pass

    if len(X) < MIN_TRADES_TO_TRAIN:
        base["reason"] = (
            f"collecting data — {len(X)} / {MIN_TRADES_TO_TRAIN} closed trades "
            f"with signal packets"
        )
    else:
        base["ready"] = True
    return base


def train() -> dict[str, Any]:
    """Fit an XGBoost classifier and persist it.  Returns status doc."""
    try:
        import xgboost as xgb
    except Exception:
        return {"trained": False, "reason": "xgboost_not_installed"}

    X, y, _ = _build_training_set()
    if len(X) < MIN_TRADES_TO_TRAIN:
        logger.info("ML train: %d < %d — not enough data", len(X), MIN_TRADES_TO_TRAIN)
        return {
            "trained": False,
            "reason": f"not_enough_data: {len(X)} < {MIN_TRADES_TO_TRAIN}",
        }

    # Simple holdout split (last 20% by chronological index would be ideal,
    # but list_trades already orders by opened_at desc so we split head/tail).
    n = len(X)
    split = max(1, int(n * 0.8))
    X_tr, y_tr = X[:split], y[:split]
    X_va, y_va = X[split:], y[split:]

    clf = xgb.XGBClassifier(
        n_estimators=120,
        max_depth=3,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="auc",
        n_jobs=2,
    )
    clf.fit(X_tr, y_tr)

    metrics: dict[str, Any] = {}
    if len(X_va) >= 5 and len(set(y_va.tolist())) > 1:
        from sklearn.metrics import roc_auc_score, accuracy_score
        preds = clf.predict_proba(X_va)[:, 1]
        try:
            metrics["val_auc"] = float(roc_auc_score(y_va, preds))
        except Exception:
            pass
        metrics["val_accuracy"] = float(accuracy_score(y_va, (preds >= 0.5).astype(int)))
    metrics["train_accuracy"] = float(clf.score(X_tr, y_tr))

    # Feature importances
    importances = dict(zip(FEATURE_NAMES, clf.feature_importances_.tolist()))
    top_features = sorted(importances.items(), key=lambda kv: -kv[1])[:5]

    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)

    doc = {
        "ready": True,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "sample_size": int(n),
        "train_size": int(len(X_tr)),
        "val_size":   int(len(X_va)),
        "positive_class_rate": float(y.mean()),
        "top_features": [{"name": k, "importance": v} for k, v in top_features],
        **metrics,
    }
    _save_status(doc)
    logger.info(
        "ML train: n=%d auc=%.3f acc=%.3f",
        n, metrics.get("val_auc", float("nan")), metrics.get("val_accuracy", float("nan")),
    )
    return doc


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

_cached_model = None


def _load_model() -> Any | None:
    global _cached_model
    if _cached_model is not None:
        return _cached_model
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            _cached_model = pickle.load(f)
    except Exception as exc:
        logger.warning("ML model load failed: %s", exc)
        _cached_model = None
    return _cached_model


def score(packet: dict[str, Any], direction: str = "LONG") -> dict[str, Any]:
    """Return {probability, ready}.  If no trained model yet, returns
    ready=False and probability=None so the caller can degrade gracefully."""
    model = _load_model()
    if model is None:
        return {"ready": False, "probability": None, "reason": "no_trained_model"}
    try:
        x = extract_features(packet, direction=direction).reshape(1, -1)
        p = float(model.predict_proba(x)[0, 1])
        return {"ready": True, "probability": round(p, 4)}
    except Exception as exc:
        return {"ready": False, "probability": None, "reason": f"score_error: {exc}"}
