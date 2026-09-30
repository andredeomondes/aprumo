"""Provedores de linguagem disponíveis, montados a partir das chaves no ambiente."""

import os

from aprumo_ai.llm import AnthropicLLM, OpenAICompatibleLLM, StructuredLLM


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
