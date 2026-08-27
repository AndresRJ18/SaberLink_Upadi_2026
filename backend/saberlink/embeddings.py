"""Loads paraphrase-multilingual-MiniLM-L12-v2 once (module-level singleton —
reloading per call would blow the live-query latency budget) and embeds
text."""

from __future__ import annotations

import threading

import numpy as np

from saberlink import config

_model = None
_model_lock = threading.Lock()


def get_model():
    # Double-checked locking: FastAPI runs sync route handlers in a thread
    # pool, so two requests can call get_model() concurrently on a fresh
    # process. Without the lock, both see _model as None and both construct
    # a SentenceTransformer — wasteful at best; observed in practice to also
    # race the same way as vector_store.get_client() below.
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer

                _model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    model = get_model()
    return np.asarray(model.encode(texts, normalize_embeddings=True))


def embed_one(text: str) -> np.ndarray:
    return embed_texts([text])[0]


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)
