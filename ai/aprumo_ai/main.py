"""Composição do serviço a partir do ambiente. Uso: uvicorn aprumo_ai.main:app"""

import logging
import os
from pathlib import Path

from aprumo_ai.api import create_app
from aprumo_ai.llm import AnthropicLLM, FallbackLLM, OpenAICompatibleLLM, StructuredLLM
from aprumo_ai.reasoner import LLMReasoner
from aprumo_ai.resilience import CachingReasoner, ResilientReasoner, RuleBasedReasoner
from aprumo_ai.retrieval import BM25Retriever, load_corpus
from aprumo_ai.service import AssessmentService

logging.basicConfig(level=logging.INFO)

CORPUS = Path(__file__).resolve().parents[1] / "data" / "corpus.json"


def providers_from_env() -> list[StructuredLLM]:
    """Ordem medida em 30/09/2026: mais rápido e estável primeiro. Só entra quem tem chave."""
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
    if key := env("GROQ_API_KEY"):
        base = "https://api.groq.com/openai/v1"
        chain.append(OpenAICompatibleLLM("groq:gpt-oss", "openai/gpt-oss-20b", base_url=base, api_key=key))
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


requirements, corpus_date = load_corpus(CORPUS)
reasoner = CachingReasoner(ResilientReasoner(LLMReasoner(FallbackLLM(providers_from_env())), RuleBasedReasoner()))
service = AssessmentService(
    retriever=BM25Retriever(requirements),
    reasoner=reasoner,
    corpus_date=corpus_date,
    min_score=float(os.environ.get("APRUMO_MIN_SCORE", "1.0")),
)
app = create_app(service, os.environ["APRUMO_INTERNAL_TOKEN"], len(requirements), corpus_date)
