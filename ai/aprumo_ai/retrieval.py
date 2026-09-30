import json
from collections import defaultdict
from pathlib import Path
from typing import Protocol

import numpy as np
from pydantic import BaseModel
from rank_bm25 import BM25Okapi

from aprumo_ai.domain import NORM_TITLES, NormHit, Requirement
from aprumo_ai.text import tokenize


class ScoredRequirement(BaseModel):
    requirement: Requirement
    score: float


class Retriever(Protocol):
    def search(self, query: str, k: int) -> list[ScoredRequirement]: ...


class BM25Retriever:
    """Busca lexical sobre os itens vigentes.

    Escolhida por caber no plano gratuito (sem modelo de embeddings em memória)
    e por ser explicável: dá para mostrar quais termos casaram com cada item.
    """

    def __init__(self, requirements: list[Requirement]) -> None:
        self._requirements = [r for r in requirements if not r.revoked]
        self._index = BM25Okapi([tokenize(f"{r.item} {r.text}") for r in self._requirements])

    def search(self, query: str, k: int) -> list[ScoredRequirement]:
        tokens = tokenize(query)
        if not tokens:
            return []
        scores = self._index.get_scores(tokens)
        top = np.argsort(scores)[::-1][:k]
        return [
            ScoredRequirement(requirement=self._requirements[i], score=float(scores[i]))
            for i in top
            if scores[i] > 0
        ]


def _norm_hit(norm: str, share: float) -> NormHit:
    return NormHit(norm=norm, title=NORM_TITLES.get(norm, norm), share=share)


def rank_norms(hits: list[ScoredRequirement], min_share: float = 0.15) -> list[NormHit]:
    """Norma aplicável = participação na soma dos scores dos itens recuperados."""
    totals: dict[str, float] = defaultdict(float)
    for hit in hits:
        totals[hit.requirement.norm] += hit.score
    grand = sum(totals.values()) or 1.0
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    return [_norm_hit(norm, round(score / grand, 3)) for norm, score in ranked if score / grand >= min_share]


def select_requirements(
    hits: list[ScoredRequirement], norms: list[NormHit], per_norm: int = 4
) -> list[Requirement]:
    """Limita itens por norma para a NR-12, a maior do corpus, não afogar as outras."""
    allowed = {n.norm for n in norms}
    count: dict[str, int] = defaultdict(int)
    chosen = []
    for hit in hits:
        norm = hit.requirement.norm
        if norm in allowed and count[norm] < per_norm:
            chosen.append(hit.requirement)
            count[norm] += 1
    return chosen


def norms_of(requirements: list[Requirement]) -> list[NormHit]:
    return [_norm_hit(norm, 0.0) for norm in sorted({r.norm for r in requirements})]


def load_corpus(path: Path) -> tuple[list[Requirement], str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Requirement(**r) for r in data["requirements"]], data["captured_at"]
