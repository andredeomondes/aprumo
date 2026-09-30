"""Mede a identificação de normas contra um gabarito escrito à mão.

Uso: python -m aprumo_ai.evaluation [--no-llm]
Com chaves de provedor no ambiente, compara BM25 puro com BM25 + expansão de consulta pelo modelo.
"""

import json
import sys
import time
from collections.abc import Callable
from pathlib import Path

from aprumo_ai.domain import NORM_TITLES
from aprumo_ai.llm import FallbackLLM
from aprumo_ai.providers import providers_from_env
from aprumo_ai.reasoner import LLMReasoner, QueryExpansion
from aprumo_ai.resilience import RuleBasedReasoner
from aprumo_ai.retrieval import BM25Retriever, load_corpus
from aprumo_ai.service import MAX_NORMS, AssessmentService

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
TRANSVERSAL = {"NR-01"}
OUT_OF_DOMAIN = [
    "Como faço uma receita de bolo de cenoura?",
    "Qual o melhor filme para assistir hoje?",
    "Organizar a festa de aniversário da empresa",
]


def predict(service: AssessmentService, query: str, expansion: QueryExpansion | None) -> tuple[list[str], float]:
    """Mesma identificação que o serviço faz em produção."""
    chosen = [code for code in (expansion.norms if expansion else []) if code in NORM_TITLES][:MAX_NORMS]
    text = f"{query} {expansion.terms}" if expansion else query
    hits, norms = service._retrieve(text, chosen)
    top = max((h.score for h in hits), default=0.0)
    return [n.norm for n in norms if n.norm not in TRANSVERSAL], top


def score(pairs: list[tuple[set[str], set[str]]]) -> tuple[float, float, float]:
    tp = sum(len(p & g) for p, g in pairs)
    fp = sum(len(p - g) for p, g in pairs)
    fn = sum(len(g - p) for p, g in pairs)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def parse_floors(argv: list[str]) -> dict[str, float]:
    """--min-f1 modo=valor: piso de qualidade que faz o CI falhar se a métrica cair."""
    if "--min-f1" not in argv:
        return {}
    mode, value = argv[argv.index("--min-f1") + 1].split("=")
    return {mode: float(value)}


def build_modes() -> dict[str, Callable[[str], QueryExpansion | None]]:
    modes: dict[str, Callable[[str], QueryExpansion | None]] = {
        "bm25": lambda activity: None,
        "bm25+regras": RuleBasedReasoner().expand_query,
    }
    if "--no-llm" in sys.argv:
        return modes
    providers = providers_from_env()
    if providers:
        reasoner = LLMReasoner(FallbackLLM(providers))

        def paced(activity: str) -> QueryExpansion:
            time.sleep(1.5)  # respeita os limites por minuto dos planos gratuitos
            return reasoner.expand_query(activity)

        modes["bm25+llm"] = paced
    return modes


def main() -> None:
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))
    requirements, corpus_date = load_corpus(ROOT / "data" / "corpus.json")
    service = AssessmentService(BM25Retriever(requirements), RuleBasedReasoner(), corpus_date)

    summary = ["| Modo | Norma principal certa | Precisão | Revocação | F1 |", "|---|---:|---:|---:|---:|"]
    errors = ["| Modo | Atividade | Esperado | Previsto |", "|---|---|---|---|"]
    f1_by_mode: dict[str, float] = {}
    for name, build in build_modes().items():
        pairs, principal_hits = [], 0
        for case in cases:
            ranked, _ = predict(service, case["activity"], build(case["activity"]))
            predicted, gold = set(ranked), set(case["norms"])
            pairs.append((predicted, gold))
            principal_hits += bool(ranked) and ranked[0] in gold
            if predicted != gold:
                errors.append(f"| {name} | {case['activity']} | {', '.join(sorted(gold))} | {', '.join(sorted(predicted)) or '—'} |")
        precision, recall, f1 = score(pairs)
        summary.append(f"| {name} | {principal_hits}/{len(cases)} | {precision:.2f} | {recall:.2f} | {f1:.2f} |")
        f1_by_mode[name] = f1

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
    for mode, floor in parse_floors(sys.argv).items():
        if f1_by_mode.get(mode, 0.0) < floor:
            raise SystemExit(f"F1 de {mode} = {f1_by_mode.get(mode, 0.0):.2f}, abaixo do piso {floor:.2f}")


if __name__ == "__main__":
    main()
