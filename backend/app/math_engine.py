"""
Hedgyyyboo — Core quantitative engine.

Provides PCA (principal component analysis) on return series and
LDA (latent Dirichlet allocation) topic modelling on news headlines.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import numpy as np
import polars as pl
from sklearn.decomposition import LatentDirichletAllocation, PCA
from sklearn.feature_extraction.text import CountVectorizer


# ---------------------------------------------------------------------------
# PCA on returns
# ---------------------------------------------------------------------------


def run_pca_analysis(df: pl.DataFrame) -> dict[str, Any]:
    """Run PCA on a Polars DataFrame of daily returns.

    Parameters
    ----------
    df:
        Must contain at least the columns ``ticker``, ``sector``,
        ``daily_return``, and ``date``.

    Returns
    -------
    dict with keys:
        explained_variance_ratio, cumulative_variance,
        component_loadings, interpretation.
    """
    # Pivot to a (days x tickers) matrix of returns
    pivot = df.pivot(on="ticker", index="date", values="daily_return").sort("date")
    ticker_cols = [c for c in pivot.columns if c != "date"]
    returns_matrix = pivot.select(ticker_cols).to_numpy()

    # Replace any NaN with 0 (safety net)
    returns_matrix = np.nan_to_num(returns_matrix, nan=0.0)

    n_components = min(5, returns_matrix.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    pca.fit(returns_matrix)

    explained = pca.explained_variance_ratio_.tolist()
    cumulative = np.cumsum(pca.explained_variance_ratio_).tolist()

    # Build a ticker -> sector lookup from the original frame
    ticker_sector: dict[str, str] = {}
    for row in df.select("ticker", "sector").unique().iter_rows(named=True):
        ticker_sector[row["ticker"]] = row["sector"]

    # Component loadings — top 10 tickers per component by |loading|
    component_loadings: dict[str, dict[str, float]] = {}
    for comp_idx in range(n_components):
        loadings = pca.components_[comp_idx]
        paired = list(zip(ticker_cols, loadings))
        paired.sort(key=lambda x: abs(x[1]), reverse=True)
        top_10 = {t: round(float(v), 6) for t, v in paired[:10]}
        component_loadings[f"PC{comp_idx + 1}"] = top_10

    # Interpretation helpers
    systemic_risk_pct = round(sum(explained[:2]) * 100, 2)
    idiosyncratic_risk_pct = round(100 - systemic_risk_pct, 2)

    # Dominant sector in PC1 — average absolute loading per sector
    pc1_loadings = pca.components_[0]
    sector_abs_loadings: dict[str, list[float]] = defaultdict(list)
    for ticker, loading in zip(ticker_cols, pc1_loadings):
        sector = ticker_sector.get(ticker, "Unknown")
        sector_abs_loadings[sector].append(abs(loading))

    dominant_sector = max(
        sector_abs_loadings,
        key=lambda s: float(np.mean(sector_abs_loadings[s])),
    )

    return {
        "explained_variance_ratio": explained,
        "cumulative_variance": cumulative,
        "component_loadings": component_loadings,
        "interpretation": {
            "systemic_risk_pct": systemic_risk_pct,
            "idiosyncratic_risk_pct": idiosyncratic_risk_pct,
            "dominant_sector": dominant_sector,
        },
    }


# ---------------------------------------------------------------------------
# LDA on headlines
# ---------------------------------------------------------------------------

_TOPIC_NAME_MAP: dict[int, str] = {
    0: "Macro Monetary Policy",
    1: "Supply Chain & Trade",
    2: "Energy & Commodities",
    3: "Technology & Innovation",
    4: "Emerging Market Risk",
}


def _infer_topic_name(top_words: list[str], topic_idx: int) -> str:
    """Attempt a reasonable topic label from the top words."""
    keyword_signals: dict[str, str] = {
        "fed": "Macro Monetary Policy",
        "rate": "Macro Monetary Policy",
        "inflation": "Macro Monetary Policy",
        "treasury": "Macro Monetary Policy",
        "monetary": "Macro Monetary Policy",
        "supply": "Supply Chain & Trade",
        "chain": "Supply Chain & Trade",
        "exports": "Supply Chain & Trade",
        "shipping": "Supply Chain & Trade",
        "chip": "Supply Chain & Trade",
        "energy": "Energy & Commodities",
        "gas": "Energy & Commodities",
        "oil": "Energy & Commodities",
        "nuclear": "Energy & Commodities",
        "power": "Energy & Commodities",
        "wind": "Energy & Commodities",
        "ai": "Technology & Innovation",
        "nvidia": "Technology & Innovation",
        "data": "Technology & Innovation",
        "cloud": "Technology & Innovation",
        "semiconductor": "Technology & Innovation",
        "currency": "Emerging Market Risk",
        "peso": "Emerging Market Risk",
        "rupee": "Emerging Market Risk",
        "lira": "Emerging Market Risk",
        "dollar": "Emerging Market Risk",
        "em": "Emerging Market Risk",
    }
    for word in top_words:
        if word.lower() in keyword_signals:
            return keyword_signals[word.lower()]
    return _TOPIC_NAME_MAP.get(topic_idx, f"Topic {topic_idx + 1}")


def run_lda_analysis(headlines: list[str]) -> dict[str, Any]:
    """Run LDA topic modelling on a list of news headlines.

    Parameters
    ----------
    headlines:
        List of headline strings.

    Returns
    -------
    dict with keys: topics, headline_assignments, regime_summary.
    """
    n_topics = 5

    vectorizer = CountVectorizer(
        max_df=0.95,
        min_df=2,
        stop_words="english",
        max_features=1000,
    )
    doc_term = vectorizer.fit_transform(headlines)
    feature_names = vectorizer.get_feature_names_out()

    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=20,
        learning_method="batch",
    )
    doc_topics = lda.fit_transform(doc_term)  # (n_docs, n_topics)

    # Build topic summaries
    topics: list[dict[str, Any]] = []
    topic_weights = lda.components_.sum(axis=1)
    topic_weights = topic_weights / topic_weights.sum()

    for idx in range(n_topics):
        top_word_indices = lda.components_[idx].argsort()[-10:][::-1]
        top_words = [str(feature_names[i]) for i in top_word_indices]
        topic_name = _infer_topic_name(top_words, idx)
        topics.append(
            {
                "topic_id": idx,
                "topic_name": topic_name,
                "top_words": top_words,
                "weight": round(float(topic_weights[idx]), 4),
            }
        )

    # Sort topics by weight descending
    topics.sort(key=lambda t: t["weight"], reverse=True)

    # Headline assignments
    headline_assignments: list[dict[str, Any]] = []
    for h_idx, headline in enumerate(headlines):
        dominant = int(np.argmax(doc_topics[h_idx]))
        confidence = float(np.max(doc_topics[h_idx]))
        headline_assignments.append(
            {
                "headline": headline,
                "dominant_topic": dominant,
                "confidence": round(confidence, 4),
            }
        )

    # Regime summary
    dominant_topic = topics[0]
    runner_up = topics[1] if len(topics) > 1 else topics[0]
    regime_summary = (
        f"Current market regime is dominated by '{dominant_topic['topic_name']}' "
        f"(weight {dominant_topic['weight']:.1%}), with "
        f"'{runner_up['topic_name']}' as the secondary theme "
        f"(weight {runner_up['weight']:.1%}). "
        f"Key narrative drivers include: {', '.join(dominant_topic['top_words'][:5])}."
    )

    return {
        "topics": topics,
        "headline_assignments": headline_assignments,
        "regime_summary": regime_summary,
    }
