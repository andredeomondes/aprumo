"""Calcula os vetores do corpus uma vez e grava em ai/data/embeddings.npy.

Uso: python -m aprumo_ai.ingestion.embed   (precisa de GEMINI_API_KEY)
O arquivo guarda float16 (metade do tamanho, perda irrelevante para similaridade de cosseno)
e o hash do corpus, para o serviço recusar vetores de um corpus diferente.
"""

import hashlib
import json
import os
import time
from pathlib import Path

import numpy as np

from aprumo_ai.domain import NORM_TITLES
from aprumo_ai.embeddings import EmbeddingError, OpenAICompatibleEmbedder
from aprumo_ai.retrieval import load_corpus

DATA = Path(__file__).resolve().parents[2] / "data"
CORPUS = DATA / "corpus.json"
VECTORS = DATA / "embeddings.npy"
META = DATA / "embeddings.json"
PARTIAL = DATA / "embeddings.partial.npy"
MODEL = "gemini-embedding-001"
DIMENSIONS = 768
BATCH = 50


def corpus_digest() -> str:
    return hashlib.sha256(CORPUS.read_bytes()).hexdigest()


def document(norm: str, text: str) -> str:
    return f"{norm} {NORM_TITLES.get(norm, '')}: {text}"[:2000]


def main() -> None:
    requirements, _ = load_corpus(CORPUS)
    embedder = OpenAICompatibleEmbedder(
        MODEL, dimensions=DIMENSIONS, api_key=os.environ["GEMINI_API_KEY"],
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/", timeout=60,
    )
    texts = [document(r.norm, r.text) for r in requirements]
    done = np.load(PARTIAL) if PARTIAL.exists() else np.empty((0, DIMENSIONS), dtype=np.float32)
    while len(done) < len(texts):
        batch = texts[len(done):len(done) + BATCH]
        for attempt in range(8):
            try:
                vectors = embedder.embed(batch)
                break
            except EmbeddingError as exc:
                wait = 15 * (attempt + 1)
                print(f"{exc}; nova tentativa em {wait}s")
                time.sleep(wait)
        else:
            raise SystemExit("Provedor de embeddings indisponível; rode de novo para retomar.")
        done = np.vstack([done, vectors])
        np.save(PARTIAL, done)  # retoma daqui se o processo cair
        print(f"{len(done)}/{len(texts)}")
        time.sleep(1.0)
    chunks = [done]
    np.save(VECTORS, np.vstack(chunks).astype(np.float16))
    META.write_text(json.dumps({
        "model": MODEL, "dimensions": DIMENSIONS, "count": len(texts), "corpus_sha256": corpus_digest(),
    }, indent=1), encoding="utf-8")
    PARTIAL.unlink(missing_ok=True)
    print(f"{len(texts)} vetores → {VECTORS.name}")


if __name__ == "__main__":
    main()
