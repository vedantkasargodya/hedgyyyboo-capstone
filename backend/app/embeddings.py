"""
Hedgyyyboo -- Hardware-agnostic embedding engine.

Uses sentence-transformers with all-MiniLM-L6-v2 for fast, high-quality
text embeddings.  Automatically detects the best available device
(CUDA > MPS > CPU) for Apple Silicon / NVIDIA / fallback support.
"""

from __future__ import annotations

import logging
from typing import ClassVar

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384  # output dimension for all-MiniLM-L6-v2


def get_device() -> str:
    """Return the best available PyTorch device string."""
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    logger.info("Selected compute device: %s", device)
    return device


class _EmbeddingEngine:
    """Singleton wrapper around SentenceTransformer so the model loads once."""

    _instance: ClassVar[_EmbeddingEngine | None] = None
    _model: SentenceTransformer | None = None
    _device: str = "cpu"

    def __new__(cls) -> _EmbeddingEngine:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_loaded(self) -> None:
        if self._model is None:
            self._device = get_device()
            logger.info("Loading embedding model '%s' on %s ...", MODEL_NAME, self._device)
            self._model = SentenceTransformer(MODEL_NAME, device=self._device)
            logger.info("Embedding model loaded successfully.")

    @property
    def device(self) -> str:
        self._ensure_loaded()
        return self._device

    def encode(self, texts: list[str], batch_size: int = 64) -> np.ndarray:
        """Encode a list of texts into dense vectors.

        Parameters
        ----------
        texts:
            Plain-text strings to embed.
        batch_size:
            Encoding batch size (tune for GPU memory).

        Returns
        -------
        np.ndarray of shape (len(texts), VECTOR_SIZE).
        """
        self._ensure_loaded()
        assert self._model is not None
        embeddings: np.ndarray = self._model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings


# Module-level convenience functions -------------------------------------------

_engine = _EmbeddingEngine()


def get_embeddings(texts: list[str], batch_size: int = 64) -> np.ndarray:
    """Batch-encode texts into normalised embedding vectors.

    Returns np.ndarray of shape ``(len(texts), 384)``.
    """
    return _engine.encode(texts, batch_size=batch_size)


def get_embedding_device() -> str:
    """Return the device string currently used by the embedding model."""
    return _engine.device
