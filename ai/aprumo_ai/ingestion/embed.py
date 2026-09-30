"""Calcula os vetores do corpus uma vez e grava em ai/data/embeddings.npy.

Uso: python -m aprumo_ai.ingestion.embed [mistral|gemini]   (padrão: mistral)
O arquivo guarda float16 (metade do tamanho, perda irrelevante para similaridade de cosseno)
e o hash do corpus, para o serviço recusar vetores de um corpus diferente.
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

from aprumo_ai.domain import NORM_TITLES
from aprumo_ai.embeddings import EMBEDDING_PROVIDERS, EmbeddingError, OpenAICompatibleEmbedder
from aprumo_ai.retrieval import load_corpus

DATA = Path(__file__).resolve().parents[2] / "data"
CORPUS = DATA / "corpus.json"
VECTORS = DATA / "embeddings.npy"
META = DATA / "embeddings.json"
PARTIAL = DATA / "embeddings.partial.npy"
BATCH = 32


def corpus_digest() -> str:
    return hashlib.sha256(CORPUS.read_bytes()).hexdigest()


def document(norm: str, text: str) -> str:
    return f"{norm} {NORM_TITLES.get(norm, '')}: {text}"[:2000]


def main() -> None:
    requirements, _ = load_corpus(CORPUS)
    provider = sys.argv[1] if len(sys.argv) > 1 else "mistral"
    base_url, key_env, model, dimensions = EMBEDDING_PROVIDERS[provider]
    embedder = OpenAICompatibleEmbedder(
        model, dimensions=dimensions, api_key=os.environ[key_env], base_url=base_url, timeout=60,
    )
    texts = [document(r.norm, r.text) for r in requirements]
    done = np.load(PARTIAL) if PARTIAL.exists() else None
    while done is None or len(done) < len(texts):
        start = 0 if done is None else len(done)
        batch = texts[start:start + BATCH]
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
        done = vectors if done is None else np.vstack([done, vectors])
        np.save(PARTIAL, done)  # retoma daqui se o processo cair
        print(f"{len(done)}/{len(texts)}")
        time.sleep(1.2)  # plano gratuito do Mistral: cerca de 1 requisição por segundo
    chunks = [done]
    np.save(VECTORS, np.vstack(chunks).astype(np.float16))
    META.write_text(json.dumps({
        "provider": provider, "model": model, "dimensions": int(done.shape[1]),
        "count": len(texts), "corpus_sha256": corpus_digest(),
    }, indent=1), encoding="utf-8")
    PARTIAL.unlink(missing_ok=True)
    print(f"{len(texts)} vetores → {VECTORS.name}")


if __name__ == "__main__":
    main()
