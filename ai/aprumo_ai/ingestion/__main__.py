"""Ingestão: PDFs oficiais das NRs → ai/data/corpus.json.

Uso: python -m aprumo_ai.ingestion
"""

import hashlib
import json
from datetime import date
from pathlib import Path

from pypdf import PdfReader

from aprumo_ai.ingestion.parser import parse_norm

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "ai" / "data" / "corpus.json"


def main() -> None:
    requirements, sources = [], []
    for pdf in sorted(RAW.glob("nr-*.pdf")):
        number = int(pdf.stem.split("-")[1])
        lines = [line for page in PdfReader(pdf).pages for line in (page.extract_text() or "").splitlines()]
        parsed = parse_norm(number, lines)
        requirements += [r.model_dump(exclude={"ref"}) for r in parsed]
        sources.append({"file": pdf.name, "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()})
        revoked = sum(r.revoked for r in parsed)
        print(f"{pdf.name}: {len(parsed)} itens ({revoked} revogados)")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    corpus = {"captured_at": date.today().isoformat(), "sources": sources, "requirements": requirements}
    OUT.write_text(json.dumps(corpus, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"total: {len(requirements)} → {OUT}")


if __name__ == "__main__":
    main()
