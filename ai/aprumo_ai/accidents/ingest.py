"""Série mensal de acidentes de trabalho a partir das CATs abertas do INSS (licença CC-BY).

Uso: python -m aprumo_ai.accidents.ingest
Baixa cada ZIP mensal, lê só o CSV de dentro (o ZIP também traz JSON e XML), conta por
CNAE × tipo de acidente e grava ai/data/accidents.json. O ZIP é apagado em seguida.
Mês = mês de processamento da CAT no arquivo, não a data do acidente: é o recorte que o
INSS publica e evita meses recentes artificialmente baixos por atraso de notificação.
"""

import csv
import io
import json
import re
import sys
import tempfile
import time
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import BinaryIO

import certifi
import ssl

DATASET = (
    "https://dadosabertos.inss.gov.br/api/3/action/package_show?"
    "id=comunicacoes-de-acidente-de-trabalho-cat-plano-de-dados-abertos-jun-2023-a-jun-2025"
)
OUT = Path(__file__).resolve().parents[2] / "data" / "accidents.json"
_MONTH = re.compile(r"CAT\.(\d{6})\.ZIP", re.IGNORECASE)
_SSL = ssl.create_default_context(cafile=certifi.where())
_TYPES = {"tipico": "tipico", "trajeto": "trajeto", "doenca": "doenca"}


def _plain(text: str) -> str:
    import unicodedata

    return "".join(c for c in unicodedata.normalize("NFD", text.strip().lower()) if unicodedata.category(c) != "Mn")


def count_month(archive: BinaryIO) -> dict[str, dict[str, int]]:
    """CNAE (4 dígitos) → contagem de acidentes típicos, de trajeto, doenças e óbitos."""
    counts: dict[str, dict[str, int]] = defaultdict(lambda: {"tipico": 0, "trajeto": 0, "doenca": 0, "obitos": 0})
    with zipfile.ZipFile(archive) as bundle:
        member = next(name for name in bundle.namelist() if name.lower().endswith(".csv"))
        with bundle.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="latin-1"), delimiter=";")
            header = [_plain(h) for h in next(reader)]
            cnae_col = next(i for i, h in enumerate(header) if h.startswith("cnae"))
            type_col = header.index("tipo do acidente")
            death_col = next(i for i, h in enumerate(header) if h.startswith("indica obito"))
            for row in reader:
                if len(row) <= max(cnae_col, type_col, death_col):
                    continue
                cnae = row[cnae_col].strip()
                if not cnae.isdigit():
                    continue
                kind = _TYPES.get(_plain(row[type_col]))
                if kind:
                    counts[cnae][kind] += 1
                if _plain(row[death_col]) == "sim":
                    counts[cnae]["obitos"] += 1
    return dict(counts)


def _fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "aprumo-ingestion"})
    with urllib.request.urlopen(request, timeout=300, context=_SSL) as response:
        return response.read()


def main() -> None:
    resources = json.loads(_fetch(DATASET))["result"]["resources"]
    urls = sorted({m.group(1): r["url"] for r in resources if (m := _MONTH.search(r["url"]))}.items())
    series = json.loads(OUT.read_text(encoding="utf-8"))["months"] if OUT.exists() else {}
    for month, url in urls:
        if month in series and "--force" not in sys.argv:
            continue
        with tempfile.TemporaryFile() as temp:
            temp.write(_fetch(url))
            temp.seek(0)
            series[month] = count_month(temp)
        total = sum(c["tipico"] for c in series[month].values())
        print(f"{month}: {total} acidentes típicos")
        OUT.write_text(json.dumps({
            "source": "INSS — Comunicações de Acidente de Trabalho (CAT), dados abertos, licença CC-BY",
            "dataset": DATASET.split("id=")[1],
            "months": dict(sorted(series.items())),
        }, ensure_ascii=False), encoding="utf-8")
        time.sleep(1)


if __name__ == "__main__":
    main()
