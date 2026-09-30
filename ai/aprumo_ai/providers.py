"""Provedores de linguagem disponíveis, montados a partir das chaves no ambiente."""

import hashlib
import json
import logging
import os
from pathlib import Path

import numpy as np

from aprumo_ai.domain import Requirement
from aprumo_ai.embeddings import EMBEDDING_PROVIDERS, OpenAICompatibleEmbedder
from aprumo_ai.hybrid import DenseIndex, HybridRetriever
from aprumo_ai.llm import AnthropicLLM, OpenAICompatibleLLM, StructuredLLM
from aprumo_ai.retrieval import BM25Retriever, Retriever

log = logging.getLogger("aprumo.providers")


def providers_from_env() -> list[StructuredLLM]:
    """Ordem medida em 30/09/2026: mais rápido e estável primeiro. Só entra quem tem chave.
    O gpt-oss-20b da Groq saiu da cadeia: falhou em 10 de 10 gerações de JSON na avaliação."""
    env = os.environ.get
    chain: list[StructuredLLM] = []
    if key := env("GROQ_API_KEY"):
        base = "https://api.groq.com/openai/v1"
        chain.append(OpenAICompatibleLLM("groq:qwen", env("GROQ_MODEL", "qwen/qwen3.8-27b"), base_url=base, api_key=key))
    if key := env("GEMINI_API_KEY"):
        chain.append(OpenAICompatibleLLM(
            "gemini", env("GEMINI_MODEL", "gemini-flash-lite-latest"),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=key,
        ))
    if key := env("OPENROUTER_API_KEY"):
        chain.append(OpenAICompatibleLLM(
            "openrouter", env("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free"),
            base_url="https://openrouter.ai/api/v1", api_key=key, extra_body={"reasoning": {"enabled": False}},
        ))
    if key := env("MISTRAL_API_KEY"):
        chain.append(OpenAICompatibleLLM(
            "mistral", env("MISTRAL_MODEL", "mistral-small-latest"), base_url="https://api.mistral.ai/v1", api_key=key,
        ))
    if env("ANTHROPIC_API_KEY"):
        chain.append(AnthropicLLM(env("APRUMO_MODEL", "claude-opus-5-5")))
    return chain


def retriever_from_env(requirements: list[Requirement], data_dir: Path) -> Retriever:
    """Híbrida quando há chave e vetores do mesmo corpus; senão, BM25 puro."""
    lexical = BM25Retriever(requirements)
    vectors_file, meta_file = data_dir / "embeddings.npy", data_dir / "embeddings.json"
    if not vectors_file.exists() or not meta_file.exists():
        log.warning("busca híbrida desligada: sem vetores; usando só BM25")
        return lexical
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    base_url, key_env, model, dimensions = EMBEDDING_PROVIDERS[meta.get("provider", "gemini")]
    key = os.environ.get(key_env)
    if not key:
        log.warning("busca híbrida desligada: falta %s; usando só BM25", key_env)
        return lexical
    digest = hashlib.sha256((data_dir / "corpus.json").read_bytes()).hexdigest()
    if meta.get("corpus_sha256") != digest:
        log.warning("vetores de outro corpus; rode python -m aprumo_ai.ingestion.embed. Usando só BM25")
        return lexical
    embedder = OpenAICompatibleEmbedder(model, dimensions=dimensions, base_url=base_url, api_key=key)
    vectors = np.load(vectors_file).astype(np.float32)
    return HybridRetriever(lexical, DenseIndex(requirements, vectors), embedder)
