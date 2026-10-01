from datetime import datetime, timezone
from typing import Protocol

from aprumo_ai.observability import METRICS
from aprumo_ai.domain import NORM_TITLES, QA, Analysis, Finding, NormHit, Question, Report, Requirement, Turn
from aprumo_ai.privacy import redact
from aprumo_ai.text import strip_accents
from aprumo_ai.reasoner import Reasoner, complete_questions
from aprumo_ai.accidents.trends import SectorTrend
from aprumo_ai.retrieval import Retriever, ScoredRequirement, norms_of, rank_norms, select_requirements

NO_BASIS = (
    "Não encontrei base nas normas do corpus para essa descrição. "
    "Descreva a atividade de trabalho: o que será feito, onde e com quais equipamentos."
)
# O prompt pede no máximo duas, mas prompt não é garantia: o limite vale no código.
MAX_NORMS = 3
NOT_COVERED = "As respostas não trouxeram informação sobre este item."
MAX_REPLY_CHARS = 600
MAX_FOLLOW_UP_CHARS = 300
# Quem não sabe não tem o que detalhar: a conversa segue e o item fica como não informado.
_UNSURE = ("nao sei", "nao tenho certeza", "desconheco")


def _opening(understanding: str, norms: list[NormHit], questions: int) -> str:
    """Abertura da conversa: o que foi entendido, quais normas entram e como vai ser."""
    names = " e ".join(filter(None, [", ".join(n.norm for n in norms[:-1]), norms[-1].norm])) if norms else ""
    applies = f"Isso entra em {names}." if len(norms) == 1 else f"Isso combina {names}."
    lead = understanding.strip() or "Entendi a atividade."
    return (
        f"{lead} {applies} Vou conversar com você sobre {questions} pontos, começando pelo planejamento. "
        "Responda com suas palavras; se não souber, é só dizer."
    )


class TrendProvider(Protocol):
    def for_norms(self, norms: list[str]) -> list[SectorTrend]: ...


class AssessmentService:
    """Orquestra recuperação e modelo, e garante as regras que não dependem do modelo:
    anonimizar antes de enviar, recusar sem base e nunca citar item não recuperado."""

    def __init__(
        self,
        retriever: Retriever,
        reasoner: Reasoner,
        corpus_date: str,
        k: int = 18,
        min_score: float = 1.0,
        per_norm: int = 6,
        trends: TrendProvider | None = None,
    ) -> None:
        self._retriever = retriever
        self._reasoner = reasoner
        self._corpus_date = corpus_date
        self._k = k
        self._min_score = min_score
        self._per_norm = per_norm
        self._trends = trends

    def _retrieve(self, query: str, chosen: list[str]) -> tuple[list[ScoredRequirement], list[NormHit]]:
        """Com normas escolhidas pelo modelo, busca dentro de cada uma: a norma extensa não afoga a
        menor. Sem escolha (ou sem acerto nela), cai na identificação pela participação no score."""
        hits = [h for code in chosen for h in self._retriever.search(query, k=self._per_norm, norms={code})]
        if hits:
            total = sum(h.score for h in hits) or 1.0
            by_norm = {code: sum(h.score for h in hits if h.requirement.norm == code) for code in chosen}
            norms = [
                NormHit(norm=code, title=NORM_TITLES[code], share=round(score / total, 3))
                for code, score in by_norm.items() if score > 0
            ]
            return hits, norms
        hits = self._retriever.search(query, k=self._k)
        return hits, rank_norms(hits)

    def analyze(self, activity: str) -> Analysis:
        clean = redact(activity)
        expansion = self._reasoner.expand_query(clean)
        if not expansion.is_work_activity:
            METRICS.inc("analysis", status="fora_do_dominio")
            return Analysis(status="sem_base", message=NO_BASIS)

        query = f"{clean} {expansion.terms}"
        chosen = [code for code in dict.fromkeys(expansion.norms) if code in NORM_TITLES][:MAX_NORMS]
        hits, norms = self._retrieve(query, chosen)
        if not hits or max(h.score for h in hits) < self._min_score:
            METRICS.inc("analysis", status="sem_base")
            return Analysis(status="sem_base", message=NO_BASIS)
        requirements = select_requirements(hits, norms, per_norm=self._per_norm)
        valid = {r.ref for r in requirements}
        generated = [
            q for q in self._reasoner.write_questions(clean, requirements)
            if q.refs and set(q.refs) <= valid
        ]
        questions = complete_questions(requirements, generated)
        METRICS.inc("analysis", status="ok")
        for norm in norms:
            METRICS.inc("norm_identified", norm=norm.norm)
        return Analysis(
            status="ok",
            message=_opening(expansion.understanding, norms, len(questions)),
            norms=norms,
            requirements=requirements,
            questions=questions,
            risk_context=self._risk_context([n.norm for n in norms]),
        )

    def converse(
        self, activity: str, question: Question, requirements: list[Requirement], answer: str, allow_follow_up: bool
    ) -> Turn:
        """Um turno da conversa. O modelo só vê os itens que a pergunta verifica, e a fala dele é
        cortada: é comentário de conversa, não entra no relatório."""
        cited = [r for r in requirements if r.ref in question.refs]
        turn = self._reasoner.converse(redact(activity), question, cited, redact(answer), allow_follow_up)
        # Dúvida do usuário volta para a mesma pergunta; aprofundar junto viraria duas perguntas de uma vez.
        unsure = strip_accents(answer.strip().lower()).startswith(_UNSURE)
        may_follow_up = allow_follow_up and turn.answered and turn.follow_up and not unsure
        follow_up = turn.follow_up.strip()[:MAX_FOLLOW_UP_CHARS] if may_follow_up else None
        METRICS.inc("turn", kind="duvida" if not turn.answered else "aprofundamento" if follow_up else "resposta")
        # Quem responde a um aprofundamento está completando a resposta: sempre conta, ou a conversa trava.
        answered = turn.answered or not allow_follow_up
        return Turn(answered=answered, reply=turn.reply.strip()[:MAX_REPLY_CHARS], follow_up=follow_up or None)

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> Report:
        clean_activity = redact(activity)
        clean_answers = [QA(question=a.question, answer=redact(a.answer)) for a in answers]
        valid = {r.ref for r in requirements}
        by_ref = {
            f.ref: f
            for f in self._reasoner.evaluate(clean_activity, requirements, clean_answers)
            if f.ref in valid
        }
        findings = [
            by_ref.get(r.ref) or Finding(ref=r.ref, status="nao_informado", justification=NOT_COVERED)
            for r in requirements
        ]
        return Report(
            activity=clean_activity,
            norms=norms_of(requirements),
            findings=findings,
            requirements=requirements,
            corpus_date=self._corpus_date,
            generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            risk_context=self._risk_context(sorted({r.norm for r in requirements})),
            answers=clean_answers,
        )

    def _risk_context(self, norms: list[str]) -> list[SectorTrend]:
        return self._trends.for_norms(norms) if self._trends else []
