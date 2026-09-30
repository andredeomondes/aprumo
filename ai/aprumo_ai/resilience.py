"""Camadas em volta do raciocínio: cache para economizar chamadas e reserva sem LLM
para a aplicação continuar de pé quando todos os provedores falharem."""

import logging
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import TypeVar

from aprumo_ai.domain import QA, Finding, Question, Requirement
from aprumo_ai.reasoner import QueryExpansion, Reasoner, ReasonerError
from aprumo_ai.text import strip_accents

log = logging.getLogger("aprumo.resilience")

R = TypeVar("R")

# Vocabulário de campo → vocabulário das normas. Cobre o corpus atual (NR-06, 10, 12, 33, 35).
_FIELD_TERMS: dict[str, str] = {
    "altura": "trabalho em altura", "poste": "trabalho em altura", "telhado": "trabalho em altura",
    "andaime": "trabalho em altura", "escada": "trabalho em altura", "fachada": "trabalho em altura",
    "cobertura": "trabalho em altura", "calha": "trabalho em altura", "linha de vida": "sistema de proteção contra quedas",
    "eletric": "instalações elétricas", "energiz": "instalações elétricas", "tensao": "instalações elétricas",
    "subestacao": "instalações elétricas", "quadro": "instalações elétricas", "rede": "instalações elétricas",
    "tanque": "espaço confinado", "silo": "espaço confinado", "galeria": "espaço confinado",
    "poco": "espaço confinado", "vaso": "espaço confinado", "caldeira": "espaço confinado",
    "prensa": "máquinas e equipamentos proteção", "torno": "máquinas e equipamentos proteção",
    "maquina": "máquinas e equipamentos proteção", "esteira": "máquinas e equipamentos proteção",
    "injetora": "máquinas e equipamentos proteção", "motor": "máquinas e equipamentos",
    "luva": "equipamento de proteção individual", "capacete": "equipamento de proteção individual",
    "botina": "equipamento de proteção individual", "epi": "equipamento de proteção individual",
    "bloqueio": "desenergização bloqueio", "solda": "permissão de trabalho",
}
_WORK_VERBS = ("manutenc", "instalac", "troca", "limpeza", "montagem", "inspec", "reparo", "operac", "servico", "trabalho")


class RuleBasedReasoner:
    """Reserva determinística: sem modelo, sem custo, sem invenção. Pior, mas nunca fora do ar."""

    def expand_query(self, activity: str) -> QueryExpansion:
        text = strip_accents(activity.lower())
        terms = sorted({norm_terms for field, norm_terms in _FIELD_TERMS.items() if field in text})
        is_work = bool(terms) or any(verb in text for verb in _WORK_VERBS)
        return QueryExpansion(is_work_activity=is_work, terms=" ".join(terms))

    def write_questions(self, activity: str, requirements: list[Requirement]) -> list[Question]:
        return [
            Question(
                id=f"q{i}",
                text=f"Como este requisito está atendido na atividade? {_summary(r.text)}",
                refs=[r.ref],
            )
            for i, r in enumerate(requirements[:6], start=1)
        ]

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> list[Finding]:
        return [
            Finding(
                ref=r.ref,
                status="decisao_humana",
                justification="A avaliação automática está indisponível; confira a resposta contra o texto do item.",
            )
            for r in requirements
        ]


def _summary(text: str, limit: int = 180) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"


class ResilientReasoner:
    """Usa o principal; se ele falhar, responde com o reserva em vez de devolver erro."""

    def __init__(self, primary: Reasoner, backup: Reasoner) -> None:
        self._primary = primary
        self._backup = backup

    def _run(self, step: str, call: Callable[[Reasoner], R]) -> R:
        try:
            return call(self._primary)
        except ReasonerError as exc:
            log.warning("%s caiu para as regras locais: %s", step, exc)
            return call(self._backup)

    def expand_query(self, activity: str) -> QueryExpansion:
        return self._run("expansão", lambda r: r.expand_query(activity))

    def write_questions(self, activity: str, requirements: list[Requirement]) -> list[Question]:
        return self._run("perguntas", lambda r: r.write_questions(activity, requirements))

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> list[Finding]:
        return self._run("avaliação", lambda r: r.evaluate(activity, requirements, answers))


class CachingReasoner:
    """Memoriza respostas por entrada. Quem testa os exemplos prontos não gasta chamada."""

    def __init__(self, inner: Reasoner, max_entries: int = 256) -> None:
        self._inner = inner
        self._max = max_entries
        self._entries: OrderedDict[Hashable, object] = OrderedDict()

    def _cached(self, key: Hashable, compute: Callable[[], R]) -> R:
        if key in self._entries:
            self._entries.move_to_end(key)
            return self._entries[key]  # type: ignore[return-value]
        value = compute()
        self._entries[key] = value
        if len(self._entries) > self._max:
            self._entries.popitem(last=False)
        return value

    def expand_query(self, activity: str) -> QueryExpansion:
        return self._cached(("expand", activity.strip().lower()), lambda: self._inner.expand_query(activity))

    def write_questions(self, activity: str, requirements: list[Requirement]) -> list[Question]:
        key = ("questions", activity.strip().lower(), tuple(r.ref for r in requirements))
        return self._cached(key, lambda: self._inner.write_questions(activity, requirements))

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> list[Finding]:
        key = (
            "evaluate",
            activity.strip().lower(),
            tuple(r.ref for r in requirements),
            tuple((a.question, a.answer.strip().lower()) for a in answers),
        )
        return self._cached(key, lambda: self._inner.evaluate(activity, requirements, answers))
