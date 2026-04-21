"""
Hedgyyyboo -- Qdrant vector store integration.

Supports two modes:
  1. Docker Qdrant on localhost:6333 (preferred if running).
  2. In-memory Qdrant (no Docker needed, data lives in-process).

Singleton pattern ensures a single client instance across the app.
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import (
    Distance,
    Filter,
    FieldCondition,
    MatchValue,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)

QDRANT_HOST = "localhost"
QDRANT_PORT = 6333


class _VectorStore:
    """Singleton Qdrant client -- tries Docker, falls back to in-memory."""

    _instance: ClassVar[_VectorStore | None] = None
    _client: QdrantClient | None = None
    _mode: str = "unknown"

    def __new__(cls) -> _VectorStore:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_client(self) -> QdrantClient:
        if self._client is not None:
            return self._client

        # Try Docker Qdrant first
        try:
            client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=3)
            # Verify connectivity with a quick health-check
            client.get_collections()
            self._client = client
            self._mode = "docker"
            logger.info("Connected to Docker Qdrant at %s:%d", QDRANT_HOST, QDRANT_PORT)
        except Exception:
            # Fall back to in-memory
            self._client = QdrantClient(":memory:")
            self._mode = "memory"
            logger.info("Using in-memory Qdrant (no Docker instance found).")

        return self._client

    @property
    def client(self) -> QdrantClient:
        return self._ensure_client()

    @property
    def mode(self) -> str:
        self._ensure_client()
        return self._mode


# Singleton instance
_store = _VectorStore()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_client() -> QdrantClient:
    """Return the singleton QdrantClient."""
    return _store.client


def get_store_mode() -> str:
    """Return 'docker' or 'memory'."""
    return _store.mode


def init_collection(collection_name: str, vector_size: int = 384) -> None:
    """Create a Qdrant collection if it does not already exist.

    Parameters
    ----------
    collection_name:
        Name of the collection.
    vector_size:
        Dimensionality of the embedding vectors (384 for MiniLM).
    """
    client = _store.client
    try:
        existing = client.get_collection(collection_name)
        logger.info(
            "Collection '%s' already exists (%d points).",
            collection_name,
            existing.points_count,
        )
    except (UnexpectedResponse, Exception):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
        logger.info("Created collection '%s' (dim=%d, cosine).", collection_name, vector_size)


def upsert_vectors(
    collection_name: str,
    ids: list[int | str],
    vectors: list[list[float]],
    payloads: list[dict[str, Any]],
) -> None:
    """Upsert vectors with metadata payloads into a collection.

    Parameters
    ----------
    collection_name:
        Target collection (must already exist).
    ids:
        Unique point IDs (ints or strings).
    vectors:
        List of embedding vectors.
    payloads:
        Metadata dicts associated with each vector.
    """
    client = _store.client
    points = [
        PointStruct(id=pid, vector=vec, payload=payload)
        for pid, vec, payload in zip(ids, vectors, payloads)
    ]
    client.upsert(collection_name=collection_name, points=points)
    logger.debug("Upserted %d points into '%s'.", len(points), collection_name)


def search_similar(
    collection_name: str,
    query_vector: list[float],
    limit: int = 10,
    score_threshold: float | None = None,
) -> list[dict[str, Any]]:
    """Find the most similar vectors in a collection.

    Returns a list of dicts with keys: id, score, payload.
    """
    client = _store.client
    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=limit,
        score_threshold=score_threshold,
    )
    return [
        {"id": hit.id, "score": hit.score, "payload": hit.payload}
        for hit in results
    ]


def get_all_vectors(
    collection_name: str,
    filter_payload: dict[str, Any] | None = None,
    limit: int = 1000,
) -> list[dict[str, Any]]:
    """Retrieve stored points, optionally filtered by payload fields.

    Parameters
    ----------
    collection_name:
        Collection to query.
    filter_payload:
        Dict of field_name -> value to filter on (exact match).
    limit:
        Maximum number of points to return.
    """
    client = _store.client

    qdrant_filter = None
    if filter_payload:
        conditions = [
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in filter_payload.items()
        ]
        qdrant_filter = Filter(must=conditions)

    results, _ = client.scroll(
        collection_name=collection_name,
        scroll_filter=qdrant_filter,
        limit=limit,
        with_vectors=True,
    )
    return [
        {"id": point.id, "vector": point.vector, "payload": point.payload}
        for point in results
    ]
