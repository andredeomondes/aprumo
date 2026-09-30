"""Mede a identificação de normas contra um gabarito escrito à mão.

Uso: python -m aprumo_ai.evaluation [--no-llm]
Com chaves de provedor no ambiente, compara BM25 puro com BM25 + expansão de consulta pelo modelo.
"""

import json
import sys
from collections.abc import Callable
from pathlib import Path

from aprumo_ai.domain import NORM_TITLES
from aprumo_ai.llm import FallbackLLM
from aprumo_ai.providers import providers_from_env
from aprumo_ai.reasoner import LLMReasoner, QueryExpansion
from aprumo_ai.resilience import RuleBasedReasoner
from aprumo_ai.retrieval import BM25Retriever, load_corpus
from aprumo_ai.service import AssessmentService

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
TRANSVERSAL = {"NR-01"}
OUT_OF_DOMAIN = [
    "Como faço uma receita de bolo de cenoura?",
    "Qual o melhor filme para assistir hoje?",
    "Organizar a festa de aniversário da empresa",
]


def predict(service: AssessmentService, query: str, expansion: QueryExpansion | None) -> tuple[set[str], float]:
    """Mesma identificação que o serviço faz em produção."""
    chosen = [code for code in (expansion.norms if expansion else []) if code in NORM_TITLES]
    text = f"{query} {expansion.terms}" if expansion else query
    hits, norms = service._retrieve(text, chosen)
    top = max((h.score for h in hits), default=0.0)
    return {n.norm for n in norms} - TRANSVERSAL, top


def score(pairs: list[tuple[set[str], set[str]]]) -> tuple[float, float, float]:
    tp = sum(len(p & g) for p, g in pairs)
    fp = sum(len(p - g) for p, g in pairs)
    fn = sum(len(g - p) for p, g in pairs)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def build_modes() -> dict[str, Callable[[str], QueryExpansion | None]]:
    modes: dict[str, Callable[[str], QueryExpansion | None]] = {
        "bm25": lambda activity: None,
        "bm25+regras": RuleBasedReasoner().expand_query,
    }
    if "--no-llm" in sys.argv:
        return modes
    providers = providers_from_env()
    if providers:
        modes["bm25+llm"] = LLMReasoner(FallbackLLM(providers)).expand_query
    return modes


def main() -> None:
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    requirements, corpus_date = load_corpus(ROOT / "data" / "corpus.json")
    service = AssessmentService(BM25Retriever(requirements), RuleBasedReasoner(), corpus_date)

    summary = ["| Modo | Precisão | Revocação | F1 | Menor score do 1º item (casos) |", "|---|---:|---:|---:|---:|"]
    errors = ["| Modo | Atividade | Esperado | Previsto |", "|---|---|---|---|"]
    for name, build in build_modes().items():
        pairs, tops = [], []
        for case in cases:
            predicted, top = predict(service, case["activity"], build(case["activity"]))
            gold = set(case["norms"])
            pairs.append((predicted, gold))
            tops.append(top)
            if predicted != gold:
                errors.append(f"| {name} | {case['activity']} | {', '.join(sorted(gold))} | {', '.join(sorted(predicted)) or '—'} |")
        precision, recall, f1 = score(pairs)
        summary.append(f"| {name} | {precision:.2f} | {recall:.2f} | {f1:.2f} | {min(tops):.1f} |")

    noise = [f"| {text} | {predict(service, text, None)[1]:.1f} |" for text in OUT_OF_DOMAIN]
    report = "\n".join([
        "# Avaliação — identificação de normas",
        "",
        f"Corpus capturado em {corpus_date} · {len(cases)} casos com gabarito · NR-01 (transversal) fora da conta.",
        "",
        *summary,
        "",
        "## Score do 1º item em frases fora do domínio (calibra `APRUMO_MIN_SCORE`)",
        "",
        "| Frase | Score |",
        "|---|---:|",
        *noise,
        "",
        "## Casos com erro",
        "",
        *errors,
        "",
    ])
    (ROOT / "EVALUATION.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
