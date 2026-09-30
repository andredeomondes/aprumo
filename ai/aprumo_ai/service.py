from datetime import datetime, timezone

from aprumo_ai.domain import NORM_TITLES, QA, Analysis, Finding, NormHit, Report, Requirement
from aprumo_ai.privacy import redact
from aprumo_ai.reasoner import Reasoner
from aprumo_ai.retrieval import Retriever, ScoredRequirement, norms_of, rank_norms, select_requirements

NO_BASIS = (
    "Não encontrei base nas normas do corpus para essa descrição. "
    "Descreva a atividade de trabalho: o que será feito, onde e com quais equipamentos."
)
# O prompt pede no máximo duas, mas prompt não é garantia: o limite vale no código.
MAX_NORMS = 3
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
        min_score: float = 1.0,
        per_norm: int = 4,
    ) -> None:
        self._retriever = retriever
        self._reasoner = reasoner
        self._corpus_date = corpus_date
        self._k = k
        self._min_score = min_score
        self._per_norm = per_norm

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
            return Analysis(status="sem_base", message=NO_BASIS)

        query = f"{clean} {expansion.terms}"
        chosen = [code for code in dict.fromkeys(expansion.norms) if code in NORM_TITLES][:MAX_NORMS]
        hits, norms = self._retrieve(query, chosen)
        if not hits or max(h.score for h in hits) < self._min_score:
            return Analysis(status="sem_base", message=NO_BASIS)
        requirements = select_requirements(hits, norms, per_norm=self._per_norm)
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
