"""Exemplos reais do contrato entre o serviço de IA e o BFF, gerados a partir do domínio.

Uso: python -m aprumo_ai.contracts
O teste do Python falha se os exemplos em contracts/ ficarem desatualizados; o teste do BFF
valida os mesmos exemplos com os schemas zod. Mudou um campo de um lado só, um dos dois quebra.
"""

import json
from pathlib import Path

from aprumo_ai.accidents.trends import SectorTrend
from aprumo_ai.domain import QA, Analysis, Finding, NormHit, Report, Requirement
from aprumo_ai.reasoner import complete_questions

OUT = Path(__file__).resolve().parents[2] / "contracts"

_REQUIREMENT = Requirement(norm="NR-35", item="35.5.1", text="Sistema de proteção contra quedas.")
_TREND = SectorTrend(
    norm="NR-18", sector="Construção", months=["202506", "202507"], values=[900, 950], last_12m=11000,
    previous_12m=10000, change_pct=10.0, deaths_12m=40, forecast=[960, 970, 980], forecast_beats_naive=True,
)


def examples() -> dict[str, dict]:
    norms = [NormHit(norm="NR-35", title="Trabalho em Altura", share=1.0)]
    analysis = Analysis(
        status="ok", message="Normas aplicáveis: NR-35.", norms=norms, requirements=[_REQUIREMENT],
        questions=complete_questions([_REQUIREMENT], []), risk_context=[_TREND],
    )
    report = Report(
        activity="Troca de luminária em poste", norms=norms,
        findings=[Finding(
            ref=_REQUIREMENT.ref, status="pendente", justification="Sem linha de vida.",
            evidence="O responsável informou que não há linha de vida.",
            recommendation="Instalar linha de vida e registrar a inspeção.",
        )],
        requirements=[_REQUIREMENT], corpus_date="2026-09-30", generated_at="2026-09-30T20:00:00+00:00",
        risk_context=[_TREND], answers=[QA(question="Há linha de vida?", answer="Não")],
    )
    return {
        "analysis.json": analysis.model_dump(mode="json"),
        "analysis-sem-base.json": Analysis(status="sem_base", message="Não encontrei base.").model_dump(mode="json"),
        "report.json": report.model_dump(mode="json"),
    }


def render() -> dict[str, str]:
    return {name: json.dumps(body, ensure_ascii=False, indent=1) + "\n" for name, body in examples().items()}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, text in render().items():
        (OUT / name).write_text(text, encoding="utf-8")
        print(f"contracts/{name}")


if __name__ == "__main__":
    main()
