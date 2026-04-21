"""
Hedgyyyboo -- Filing Delta Vector Diffing Engine.

Mathematically compares SEC filings across periods using cosine similarity
of sentence embeddings to detect added, modified, and removed language.
"""

from __future__ import annotations

import logging
import hashlib
from typing import Any

import numpy as np

from .embeddings import get_embeddings, VECTOR_SIZE
from .vector_store import init_collection, upsert_vectors, get_all_vectors
from .sec_parser import (
    get_company_filings,
    download_filing_html,
    extract_risk_factors,
    extract_mda,
    chunk_text,
)

logger = logging.getLogger(__name__)

# Similarity thresholds
THRESHOLD_ADDED = 0.70       # Below this = new content
THRESHOLD_MODIFIED = 0.90    # Between ADDED and this = modified
# Above MODIFIED = unchanged


def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def find_best_match(
    query_vec: np.ndarray,
    candidate_vecs: np.ndarray,
) -> tuple[int, float]:
    """Find the best matching vector index and its cosine similarity."""
    if len(candidate_vecs) == 0:
        return -1, 0.0

    # Normalise for cosine similarity via dot product
    query_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    candidate_norms = candidate_vecs / (
        np.linalg.norm(candidate_vecs, axis=1, keepdims=True) + 1e-10
    )
    similarities = candidate_norms @ query_norm
    best_idx = int(np.argmax(similarities))
    return best_idx, float(similarities[best_idx])


def compute_filing_delta(
    ticker: str,
    filing_type: str = "10-K",
    section: str = "risk_factors",
) -> dict[str, Any]:
    """Orchestrate the full Filing Delta analysis.

    1. Fetch 2 most recent filings from SEC EDGAR
    2. Extract the target section
    3. Chunk & embed
    4. Compare vectors via cosine similarity
    5. Classify changes: added / modified / removed / unchanged
    6. Compute divergence score
    """
    logger.info("Starting Filing Delta for %s (%s, %s)", ticker, filing_type, section)

    # ── Step 1: Fetch filings ────────────────────────────────────────
    filings = get_company_filings(ticker, filing_type=filing_type, count=2)
    if len(filings) < 2:
        raise ValueError(
            f"Need at least 2 {filing_type} filings for {ticker}, found {len(filings)}"
        )

    current_filing = filings[0]
    previous_filing = filings[1]
    logger.info(
        "Comparing %s (%s) vs %s (%s)",
        current_filing["filing_date"],
        current_filing["accession_number"],
        previous_filing["filing_date"],
        previous_filing["accession_number"],
    )

    # ── Step 2: Download & extract ───────────────────────────────────
    current_html = download_filing_html(current_filing["filing_url"])
    previous_html = download_filing_html(previous_filing["filing_url"])

    extractor = extract_risk_factors if section == "risk_factors" else extract_mda

    current_text = extractor(current_html)
    previous_text = extractor(previous_html)

    # ── Step 3: Chunk ────────────────────────────────────────────────
    current_chunks = chunk_text(current_text, chunk_size=512, overlap=50)
    previous_chunks = chunk_text(previous_text, chunk_size=512, overlap=50)

    if not current_chunks or not previous_chunks:
        return {
            "ticker": ticker,
            "filing_type": filing_type,
            "section": section,
            "current_filing_date": current_filing["filing_date"],
            "previous_filing_date": previous_filing["filing_date"],
            "divergence_score": 0,
            "error": "Could not extract sufficient text from filings",
            "total_chunks_current": len(current_chunks),
            "total_chunks_previous": len(previous_chunks),
            "added": [],
            "modified": [],
            "removed": [],
            "unchanged_count": 0,
            "summary_stats": {
                "added_pct": 0, "modified_pct": 0,
                "removed_pct": 0, "unchanged_pct": 0,
            },
        }

    logger.info(
        "Chunked: current=%d chunks, previous=%d chunks",
        len(current_chunks),
        len(previous_chunks),
    )

    # ── Step 4: Embed ────────────────────────────────────────────────
    current_vecs = get_embeddings(current_chunks)
    previous_vecs = get_embeddings(previous_chunks)

    # ── Step 5: Store in Qdrant ──────────────────────────────────────
    collection_name = f"filing_{ticker}_{filing_type}".lower().replace("-", "_")
    init_collection(collection_name, vector_size=VECTOR_SIZE)

    def _hash_id(prefix: str, idx: int) -> int:
        h = hashlib.md5(f"{prefix}_{idx}".encode()).hexdigest()[:15]
        return int(h, 16)

    # Upsert current filing vectors
    upsert_vectors(
        collection_name,
        ids=[_hash_id("current", i) for i in range(len(current_chunks))],
        vectors=current_vecs.tolist(),
        payloads=[
            {
                "ticker": ticker,
                "period": "current",
                "filing_date": current_filing["filing_date"],
                "chunk_index": i,
                "text": current_chunks[i][:500],
            }
            for i in range(len(current_chunks))
        ],
    )

    # Upsert previous filing vectors
    upsert_vectors(
        collection_name,
        ids=[_hash_id("previous", i) for i in range(len(previous_chunks))],
        vectors=previous_vecs.tolist(),
        payloads=[
            {
                "ticker": ticker,
                "period": "previous",
                "filing_date": previous_filing["filing_date"],
                "chunk_index": i,
                "text": previous_chunks[i][:500],
            }
            for i in range(len(previous_chunks))
        ],
    )

    # ── Step 6: Compare current→previous ─────────────────────────────
    added: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    unchanged_count = 0

    for i, (chunk, vec) in enumerate(zip(current_chunks, current_vecs)):
        best_idx, sim = find_best_match(vec, previous_vecs)

        if sim < THRESHOLD_ADDED:
            added.append({"text": chunk[:500], "chunk_index": i, "similarity": round(sim, 3)})
        elif sim < THRESHOLD_MODIFIED:
            modified.append({
                "text": chunk[:500],
                "old_text": previous_chunks[best_idx][:500] if best_idx >= 0 else "",
                "similarity": round(sim, 3),
                "chunk_index": i,
            })
        else:
            unchanged_count += 1

    # ── Step 7: Find removed chunks ──────────────────────────────────
    removed: list[dict[str, Any]] = []
    for i, (chunk, vec) in enumerate(zip(previous_chunks, previous_vecs)):
        best_idx, sim = find_best_match(vec, current_vecs)
        if sim < THRESHOLD_ADDED:
            removed.append({"text": chunk[:500], "chunk_index": i, "similarity": round(sim, 3)})

    # ── Step 8: Divergence score ─────────────────────────────────────
    total_current = len(current_chunks)
    total_previous = len(previous_chunks)
    total_all = max(total_current + total_previous, 1)

    added_weight = len(added) * 1.5
    modified_weight = len(modified) * 1.0
    removed_weight = len(removed) * 1.5

    raw_score = (added_weight + modified_weight + removed_weight) / total_all * 100
    divergence_score = min(100, round(raw_score, 1))

    # Summary stats
    added_pct = round(len(added) / max(total_current, 1) * 100, 1)
    modified_pct = round(len(modified) / max(total_current, 1) * 100, 1)
    removed_pct = round(len(removed) / max(total_previous, 1) * 100, 1)
    unchanged_pct = round(unchanged_count / max(total_current, 1) * 100, 1)

    logger.info(
        "Filing Delta complete: divergence=%.1f, added=%d, modified=%d, removed=%d, unchanged=%d",
        divergence_score, len(added), len(modified), len(removed), unchanged_count,
    )

    return {
        "ticker": ticker.upper(),
        "filing_type": filing_type,
        "section": section,
        "current_filing_date": current_filing["filing_date"],
        "previous_filing_date": previous_filing["filing_date"],
        "divergence_score": divergence_score,
        "total_chunks_current": total_current,
        "total_chunks_previous": total_previous,
        "added": added[:30],
        "modified": modified[:30],
        "removed": removed[:30],
        "unchanged_count": unchanged_count,
        "summary_stats": {
            "added_pct": added_pct,
            "modified_pct": modified_pct,
            "removed_pct": removed_pct,
            "unchanged_pct": unchanged_pct,
        },
    }
