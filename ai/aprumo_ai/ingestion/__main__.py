"""Ingestão: PDFs oficiais das NRs → ai/data/corpus.json + ai/data/INGESTION.md.

Uso: python -m aprumo_ai.ingestion
PyMuPDF em vez de pypdf: na medição sobre as NR-06, 18 e 35, pypdf separou 28 palavras
ao meio ("si stema", "san itária") e PyMuPDF nenhuma, em 1/20 do tempo.
"""

import hashlib
import json
import re
from datetime import date
from pathlib import Path

import pymupdf

from aprumo_ai.domain import NORM_TITLES, Requirement
from aprumo_ai.ingestion.parser import parse_norm

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "ai" / "data" / "corpus.json"
REPORT = ROOT / "ai" / "data" / "INGESTION.md"

_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")


def extract_lines(pdf: Path) -> list[str]:
    with pymupdf.open(pdf) as document:
        text = "\n".join(page.get_text() for page in document)
    return _HYPHEN_BREAK.sub(r"\1\2", text).splitlines()


def quality_row(code: str, requirements: list[Requirement]) -> str:
    short = sum(len(r.text) < 25 for r in requirements)
    revoked = sum(r.revoked for r in requirements)
    annex = sum(r.annex is not None for r in requirements)
    return f"| {code} | {len(requirements)} | {revoked} | {annex} | {short} |"


def main() -> None:
    requirements: list[Requirement] = []
    sources, rows = [], []
    for pdf in sorted(RAW.glob("nr-*.pdf")):
        number = int(pdf.stem.split("-")[1])
        code = f"NR-{number:02d}"
        if code not in NORM_TITLES:
            print(f"{pdf.name}: fora do catálogo de normas vigentes, ignorado")
            continue
        parsed = parse_norm(number, extract_lines(pdf))
        requirements += parsed
        sources.append({"file": pdf.name, "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()})
        rows.append(quality_row(code, parsed))
        print(f"{pdf.name}: {len(parsed)} itens")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    corpus = {
        "captured_at": date.today().isoformat(),
        "sources": sources,
        "requirements": [r.model_dump(exclude={"ref"}) for r in requirements],
    }
    OUT.write_text(json.dumps(corpus, ensure_ascii=False, indent=1), encoding="utf-8")
    revoked = sum(r.revoked for r in requirements)
    REPORT.write_text("\n".join([
        "# Qualidade da ingestão",
        "",
        f"Capturado em {corpus['captured_at']} · {len(sources)} normas · {len(requirements)} itens · "
        f"{revoked} revogados (fora da busca).",
        "",
        "Itens curtos (< 25 caracteres) costumam ser títulos de seção ou texto perdido em tabela: "
        "vale revisar quando o número sobe.",
        "",
        "| Norma | Itens | Revogados | Em anexo | Curtos |",
        "|---|---:|---:|---:|---:|",
        *rows,
        "",
    ]), encoding="utf-8")
    print(f"total: {len(requirements)} itens → {OUT.name}, relatório → {REPORT.name}")


if __name__ == "__main__":
    main()
