"""Provedores de linguagem disponíveis, montados a partir das chaves no ambiente."""

import hashlib
import json
import logging
import os
from pathlib import Path

import numpy as np

from aprumo_ai.domain import Requirement
from aprumo_ai.embeddings import OpenAICompatibleEmbedder
from aprumo_ai.hybrid import DenseIndex, HybridRetriever
from aprumo_ai.llm import AnthropicLLM, OpenAICompatibleLLM, StructuredLLM
from aprumo_ai.retrieval import BM25Retriever, Retriever

log = logging.getLogger("aprumo.providers")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


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
    key = os.environ.get("GEMINI_API_KEY")
    vectors_file, meta_file = data_dir / "embeddings.npy", data_dir / "embeddings.json"
    if not key or not vectors_file.exists() or not meta_file.exists():
        log.warning("busca híbrida desligada: falta chave ou vetores; usando só BM25")
        return lexical
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    digest = hashlib.sha256((data_dir / "corpus.json").read_bytes()).hexdigest()
    if meta.get("corpus_sha256") != digest:
        log.warning("vetores de outro corpus; rode python -m aprumo_ai.ingestion.embed. Usando só BM25")
        return lexical
    embedder = OpenAICompatibleEmbedder(
        meta.get("model", "gemini-embedding-001"), dimensions=meta.get("dimensions", 768),
        base_url=GEMINI_URL, api_key=key,
    )
    vectors = np.load(vectors_file).astype(np.float32)
    return HybridRetriever(lexical, DenseIndex(requirements, vectors), embedder)
