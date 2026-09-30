from datetime import datetime, timezone

from aprumo_ai.domain import QA, Analysis, Finding, Report, Requirement
from aprumo_ai.privacy import redact
from aprumo_ai.reasoner import Reasoner
from aprumo_ai.retrieval import Retriever, norms_of, rank_norms, select_requirements

NO_BASIS = (
    "Não encontrei base nas normas do corpus (NR-01, 06, 10, 12, 33 e 35) para essa descrição. "
    "Descreva a atividade de trabalho: o que será feito, onde e com quais equipamentos."
)
NOT_COVERED = "As respostas não trouxeram informação sobre este item."


class AssessmentService:
    """Orquestra recuperação e modelo, e garante as regras que não dependem do modelo:
    anonimizar antes de enviar, recusar sem base e nunca citar item não recuperado."""

    def __init__(
        self,
        retriever: Retriever,
        reasoner: Reasoner,
        corpus_date: str,
        k: int = 12,
        min_score: float = 4.0,
    ) -> None:
        self._retriever = retriever
        self._reasoner = reasoner
        self._corpus_date = corpus_date
        self._k = k
        self._min_score = min_score

    def analyze(self, activity: str) -> Analysis:
        clean = redact(activity)
        expansion = self._reasoner.expand_query(clean)
        if not expansion.is_work_activity:
            return Analysis(status="sem_base", message=NO_BASIS)

        hits = self._retriever.search(f"{clean} {expansion.terms}", k=self._k)
        if not hits or hits[0].score < self._min_score:
            return Analysis(status="sem_base", message=NO_BASIS)

        norms = rank_norms(hits)
        requirements = select_requirements(hits, norms)
        valid = {r.ref for r in requirements}
        questions = [
            q for q in self._reasoner.write_questions(clean, requirements)
            if q.refs and set(q.refs) <= valid
        ]
        names = ", ".join(n.norm for n in norms)
        return Analysis(
            status="ok",
            message=f"Normas aplicáveis: {names}. Vou fazer {len(questions)} perguntas.",
            norms=norms,
            requirements=requirements,
            questions=questions,
        )

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
        )
