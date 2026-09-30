"""Busca híbrida: BM25 acha o termo exato ("NR-10", "SPIQ", "10.2.8"); o vetor acha o
significado ("poste" → trabalho em altura). As duas listas se fundem por Reciprocal Rank
Fusion, que usa só a posição e dispensa calibrar escalas de score diferentes."""

import logging
from collections import defaultdict

import numpy as np

from aprumo_ai.domain import Requirement
from aprumo_ai.embeddings import Embedder, EmbeddingError
from aprumo_ai.observability import METRICS
from aprumo_ai.retrieval import BM25Retriever, ScoredRequirement

log = logging.getLogger("aprumo.hybrid")

# Constante usual do RRF; o fator 100 só traz o score para a faixa do piso do serviço.
_RRF_K = 60
_SCALE = 100.0


class DenseIndex:
    def __init__(self, requirements: list[Requirement], vectors: np.ndarray) -> None:
        if len(requirements) != len(vectors):
            raise ValueError(f"{len(requirements)} itens para {len(vectors)} vetores")
        keep = [i for i, r in enumerate(requirements) if not r.revoked]
        self._requirements = [requirements[i] for i in keep]
        self._vectors = np.asarray(vectors, dtype=np.float32)[keep]
        self._norm_of = np.array([r.norm for r in self._requirements])

    def search(self, query_vector: np.ndarray, k: int, norms: set[str] | None = None) -> list[ScoredRequirement]:
        similarity = self._vectors @ np.asarray(query_vector, dtype=np.float32)
        if norms is not None:
            similarity = np.where(np.isin(self._norm_of, list(norms)), similarity, -np.inf)
        top = np.argsort(similarity)[::-1][:k]
        return [
            ScoredRequirement(requirement=self._requirements[i], score=float(similarity[i]))
            for i in top
            if np.isfinite(similarity[i])
        ]


class HybridRetriever:
    def __init__(self, lexical: BM25Retriever, dense: DenseIndex, embedder: Embedder, depth: int = 30) -> None:
        self._lexical = lexical
        self._dense = dense
        self._embedder = embedder
        self._depth = depth

    def search(self, query: str, k: int, norms: set[str] | None = None) -> list[ScoredRequirement]:
        depth = max(k, self._depth)
        lexical = self._lexical.search(query, k=depth, norms=norms)
        try:
            vector = self._embedder.embed([query])[0]
        except EmbeddingError as exc:
            log.warning("busca densa indisponível, só BM25: %s", exc)
            METRICS.inc("retrieval", mode="lexical_fallback")
            return lexical[:k]
        dense = self._dense.search(vector, k=depth, norms=norms)
        METRICS.inc("retrieval", mode="hybrid")

        fused: dict[str, float] = defaultdict(float)
        by_ref: dict[str, Requirement] = {}
        for ranking in (lexical, dense):
            for position, hit in enumerate(ranking, start=1):
                fused[hit.requirement.ref] += _SCALE / (_RRF_K + position)
                by_ref[hit.requirement.ref] = hit.requirement
        ranked = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)[:k]
        return [ScoredRequirement(requirement=by_ref[ref], score=score) for ref, score in ranked]
