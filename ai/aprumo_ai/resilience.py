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

# Vocabulário de campo → (vocabulário das normas, norma). Cobre o corpus atual.
_ALTURA = ("trabalho em altura", "NR-35")
_ELETRICA = ("instalações elétricas", "NR-10")
_CONFINADO = ("espaço confinado", "NR-33")
_MAQUINA = ("máquinas e equipamentos proteção", "NR-12")
_EPI = ("equipamento de proteção individual", "NR-06")
_MOVIMENTACAO = ("transporte movimentação de materiais", "NR-11")
_PRESSAO = ("caldeiras vasos de pressão", "NR-13")
_INFLAMAVEL = ("inflamáveis e combustíveis", "NR-20")
_CONSTRUCAO = ("indústria da construção", "NR-18")
_ERGONOMIA = ("ergonomia levantamento de cargas", "NR-17")
_EXPOSICAO = ("exposições ocupacionais agentes físicos químicos", "NR-09")
_INCENDIO = ("proteção contra incêndios", "NR-23")

_FIELD_TERMS: dict[str, tuple[str, str]] = {
    "altura": _ALTURA, "poste": _ALTURA, "telhado": _ALTURA, "andaime": _ALTURA, "escada": _ALTURA,
    "fachada": _ALTURA, "cobertura": _ALTURA, "calha": _ALTURA, "linha de vida": _ALTURA,
    "eletric": _ELETRICA, "energiz": _ELETRICA, "tensao": _ELETRICA, "subestacao": _ELETRICA,
    "quadro de": _ELETRICA, "rede eletrica": _ELETRICA, "luminaria": _ELETRICA,
    "tanque": _CONFINADO, "silo": _CONFINADO, "galeria": _CONFINADO, "poco": _CONFINADO, "escotilha": _CONFINADO,
    "prensa": _MAQUINA, "torno": _MAQUINA, "maquina": _MAQUINA, "esteira": _MAQUINA, "injetora": _MAQUINA,
    "serra": _MAQUINA, "motor": _MAQUINA,
    "luva": _EPI, "capacete": _EPI, "botina": _EPI, "epi": _EPI, "oculos": _EPI,
    "empilhadeira": _MOVIMENTACAO, "ponte rolante": _MOVIMENTACAO, "talha": _MOVIMENTACAO,
    "guindaste": _MOVIMENTACAO, "palete": _MOVIMENTACAO, "icamento": _MOVIMENTACAO,
    "caldeira": _PRESSAO, "vaso de pressao": _PRESSAO, "autoclave": _PRESSAO, "hidrostatic": _PRESSAO,
    "combustivel": _INFLAMAVEL, "inflamavel": _INFLAMAVEL, "gas": _INFLAMAVEL, "solvente": _INFLAMAVEL,
    "obra": _CONSTRUCAO, "concret": _CONSTRUCAO, "forma": _CONSTRUCAO, "demolicao": _CONSTRUCAO, "escavacao": _CONSTRUCAO,
    "levantamento manual": _ERGONOMIA, "postura": _ERGONOMIA, "ergonom": _ERGONOMIA,
    "ruido": _EXPOSICAO, "calor": _EXPOSICAO, "vibracao": _EXPOSICAO, "poeira": _EXPOSICAO, "quimico": _EXPOSICAO,
    "incendio": _INCENDIO, "extintor": _INCENDIO,
}
_WORK_VERBS = ("manutenc", "instalac", "troca", "limpeza", "montagem", "inspec", "reparo", "operac", "servico", "trabalho")


class RuleBasedReasoner:
    """Reserva determinística: sem modelo, sem custo, sem invenção. Pior, mas nunca fora do ar."""

    def expand_query(self, activity: str) -> QueryExpansion:
        text = strip_accents(activity.lower())
        matched = [pair for field, pair in _FIELD_TERMS.items() if field in text]
        terms = sorted({norm_terms for norm_terms, _ in matched})
        norms = list(dict.fromkeys(norm for _, norm in matched))[:3]
        is_work = bool(matched) or any(verb in text for verb in _WORK_VERBS)
        return QueryExpansion(is_work_activity=is_work, terms=" ".join(terms), norms=norms)

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
