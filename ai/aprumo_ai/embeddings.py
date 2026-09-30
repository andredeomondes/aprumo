"""Embeddings por API. Um modelo local (torch) não cabe nos 512 MB do plano gratuito;
os vetores do corpus são calculados uma vez, offline, e só a consulta passa pela API."""

from typing import Protocol

import numpy as np
import openai


# Provedor → (URL compatível com a OpenAI, variável da chave, modelo, dimensões ou None).
# Gemini dá 1.000 textos por dia no plano gratuito, pouco para 5 mil itens; o Mistral é o padrão.
EMBEDDING_PROVIDERS: dict[str, tuple[str, str, str, int | None]] = {
    "mistral": ("https://api.mistral.ai/v1", "MISTRAL_API_KEY", "mistral-embed", None),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY", "gemini-embedding-001", 768),
}


class EmbeddingError(Exception):
    """O provedor de embeddings falhou; quem chama deve cair na busca lexical."""


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray: ...


def normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.where(norms == 0, 1, norms)


class OpenAICompatibleEmbedder:
    def __init__(
        self,
        model: str,
        *,
        dimensions: int | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        client: object | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.model = model
        self.dimensions = dimensions
        self._client = client or openai.OpenAI(base_url=base_url, api_key=api_key, timeout=timeout, max_retries=1)

    def embed(self, texts: list[str]) -> np.ndarray:
        try:
            extra = {"dimensions": self.dimensions} if self.dimensions else {}
            response = self._client.embeddings.create(model=self.model, input=texts, **extra)
        except openai.APIError as exc:
            raise EmbeddingError(f"embeddings: {type(exc).__name__}") from exc
        return normalize(np.array([d.embedding for d in response.data], dtype=np.float32))
