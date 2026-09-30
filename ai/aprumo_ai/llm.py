"""Acesso a modelos de linguagem com saída estruturada e fallback entre provedores.

Todo provedor devolve uma instância validada do schema Pydantic pedido, ou levanta
LLMError. A cadeia (FallbackLLM) passa para o próximo provedor em qualquer falha e
tira de circulação por um tempo quem respondeu 429.
"""

import json
import logging
import re
import time
from collections.abc import Callable, Sequence
from typing import Protocol, TypeVar

import anthropic
import openai
from pydantic import BaseModel, ValidationError

log = logging.getLogger("aprumo.llm")

T = TypeVar("T", bound=BaseModel)

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


class LLMError(Exception):
    def __init__(self, message: str, rate_limited: bool = False) -> None:
        super().__init__(message)
        self.rate_limited = rate_limited


class StructuredLLM(Protocol):
    name: str

    def generate(self, schema: type[T], system: str, prompt: str, max_tokens: int) -> T: ...


def _schema_instruction(schema: type[BaseModel]) -> str:
    compact = json.dumps(schema.model_json_schema(), ensure_ascii=False, separators=(",", ":"))
    return f"Responda apenas com um objeto JSON válido que siga este JSON Schema: {compact}"


def _parse(schema: type[T], content: str | None) -> T:
    match = _JSON_OBJECT.search(content or "")
    if not match:
        raise LLMError("Resposta sem objeto JSON.")
    try:
        return schema.model_validate_json(match.group(0))
    except ValidationError as exc:
        raise LLMError(f"JSON fora do formato esperado: {exc.error_count()} erro(s).") from exc


class OpenAICompatibleLLM:
    """Qualquer provedor com API no formato da OpenAI: Groq, Gemini, OpenRouter, Mistral, Cerebras."""

    def __init__(
        self,
        name: str,
        model: str,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        extra_body: dict | None = None,
        client: object | None = None,
        timeout: float = 25.0,
    ) -> None:
        self.name = name
        self._model = model
        self._extra_body = extra_body
        # Sem retry no SDK: quem tenta de novo é a cadeia, em outro provedor.
        self._client = client or openai.OpenAI(base_url=base_url, api_key=api_key, timeout=timeout, max_retries=0)

    def generate(self, schema: type[T], system: str, prompt: str, max_tokens: int) -> T:
        kwargs: dict = {
            "model": self._model,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": f"{system}\n\n{_schema_instruction(schema)}"},
                {"role": "user", "content": prompt},
            ],
        }
        if self._extra_body:
            kwargs["extra_body"] = self._extra_body
        try:
            completion = self._client.chat.completions.create(**kwargs)
        except openai.RateLimitError as exc:
            raise LLMError(f"{self.name}: limite de taxa", rate_limited=True) from exc
        except openai.APIError as exc:
            raise LLMError(f"{self.name}: {type(exc).__name__}") from exc
        return _parse(schema, completion.choices[0].message.content)


class AnthropicLLM:
    """Claude com saída estruturada nativa e fallback de recusa feito pela própria API."""

    _FALLBACK_BETA = "server-side-fallback-2026-07-01"

    def __init__(self, model: str, client: anthropic.Anthropic | None = None, effort: str = "low") -> None:
        self.name = f"anthropic:{model}"
        self._model = model
        self._effort = effort
        self._client = client or anthropic.Anthropic(max_retries=0, timeout=40.0)

    def generate(self, schema: type[T], system: str, prompt: str, max_tokens: int) -> T:
        try:
            response = self._client.beta.messages.parse(
                model=self._model,
                betas=[self._FALLBACK_BETA],
                fallbacks="default",
                max_tokens=max(max_tokens, 4000),
                system=system,
                output_config={"effort": self._effort},
                messages=[{"role": "user", "content": prompt}],
                output_format=schema,
            )
        except anthropic.RateLimitError as exc:
            raise LLMError(f"{self.name}: limite de taxa", rate_limited=True) from exc
        except anthropic.APIError as exc:
            raise LLMError(f"{self.name}: {type(exc).__name__}") from exc
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise LLMError(f"{self.name}: sem resposta válida")
        return response.parsed_output


class FallbackLLM:
    """Tenta cada provedor em ordem; quem devolve 429 fica fora por `cooldown_seconds`."""

    name = "cadeia"

    def __init__(
        self,
        providers: Sequence[StructuredLLM],
        cooldown_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._providers = list(providers)
        self._cooldown = cooldown_seconds
        self._clock = clock
        self._resting_until: dict[str, float] = {}
        self.last_provider: str | None = None

    def generate(self, schema: type[T], system: str, prompt: str, max_tokens: int) -> T:
        failures = []
        for provider in self._providers:
            if self._resting_until.get(provider.name, 0.0) > self._clock():
                continue
            try:
                result = provider.generate(schema, system, prompt, max_tokens)
            except LLMError as exc:
                failures.append(str(exc))
                log.warning("provedor falhou: %s", exc)
                if exc.rate_limited:
                    self._resting_until[provider.name] = self._clock() + self._cooldown
                continue
            self.last_provider = provider.name
            log.info("respondido por %s", provider.name)
            return result
        raise LLMError("Nenhum provedor respondeu: " + "; ".join(failures or ["todos em pausa"]))
