"""Série mensal de acidentes de trabalho a partir das CATs abertas do INSS (licença CC-BY).

Uso: python -m aprumo_ai.accidents.ingest
Baixa cada ZIP mensal, lê só o CSV de dentro (o ZIP também traz JSON e XML) e conta por
mês do acidente × CNAE × tipo. Grava ai/data/accidents.json e apaga o ZIP.

Por que o mês do acidente, e não o do arquivo: os arquivos mensais oscilam por questões de
publicação (abr/2024 com o dobro do normal, set/2024 a fev/2025 quase vazios, jun/2026 com
acúmulo). Somando todos os arquivos pela data do acidente, cada CAT cai no mês em que o
acidente aconteceu. Os meses mais recentes ficam incompletos por atraso de notificação e
são cortados em `complete_until`.
"""

import csv
import io
import json
import re
import ssl
import sys
import tempfile
import time
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import BinaryIO

import certifi

DATASET = (
    "https://dadosabertos.inss.gov.br/api/3/action/package_show?"
    "id=comunicacoes-de-acidente-de-trabalho-cat-plano-de-dados-abertos-jun-2023-a-jun-2025"
)
OUT = Path(__file__).resolve().parents[2] / "data" / "accidents.json"
_FILE_MONTH = re.compile(r"CAT\.(\d{6})\.ZIP", re.IGNORECASE)
_DATE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
_SSL = ssl.create_default_context(cafile=certifi.where())
_TYPES = {"tipico": "tipico", "trajeto": "trajeto", "doenca": "doenca"}
# Meses finais descartados: CATs de acidentes recentes ainda estão chegando.
NOTIFICATION_LAG_MONTHS = 3

Counts = dict[str, dict[str, dict[str, int]]]


def _plain(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.strip().lower()) if unicodedata.category(c) != "Mn")


def _empty() -> dict[str, int]:
    return {"tipico": 0, "trajeto": 0, "doenca": 0, "obitos": 0}


def count_month(archive: BinaryIO) -> Counts:
    """Mês do acidente (AAAAMM) → CNAE (4 dígitos) → acidentes típicos, de trajeto, doenças e óbitos."""
    counts: Counts = defaultdict(lambda: defaultdict(_empty))
    with zipfile.ZipFile(archive) as bundle:
        member = next(name for name in bundle.namelist() if name.lower().endswith(".csv"))
        with bundle.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="latin-1"), delimiter=";")
            header = [_plain(h) for h in next(reader)]
            date_col = header.index("data acidente")
            cnae_col = next(i for i, h in enumerate(header) if h.startswith("cnae"))
            type_col = header.index("tipo do acidente")
            death_col = next(i for i, h in enumerate(header) if h.startswith("indica obito"))
            for row in reader:
                if len(row) <= max(date_col, cnae_col, type_col, death_col):
                    continue
                date = _DATE.match(row[date_col].strip())
                cnae = row[cnae_col].strip()
                if not date or date.group(3) == "0000" or not cnae.isdigit():
                    continue
                cell = counts[f"{date.group(3)}{date.group(2)}"][cnae]
                kind = _TYPES.get(_plain(row[type_col]))
                if kind:
                    cell[kind] += 1
                if _plain(row[death_col]) == "sim":
                    cell["obitos"] += 1
    return {month: dict(cnaes) for month, cnaes in counts.items()}


def merge(total: Counts, part: Counts) -> None:
    for month, cnaes in part.items():
        for cnae, values in cnaes.items():
            cell = total.setdefault(month, {}).setdefault(cnae, _empty())
            for key, value in values.items():
                cell[key] += value


def _shift(yyyymm: str, months: int) -> str:
    index = int(yyyymm[:4]) * 12 + int(yyyymm[4:]) - 1 - months
    return f"{index // 12:04d}{index % 12 + 1:02d}"


def _fetch(url: str, attempts: int = 4) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "aprumo-ingestion"})
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=300, context=_SSL) as response:
                return response.read()
        except (OSError, ssl.SSLError) as exc:  # arquivos de ~40 MB: queda de conexão acontece
            if attempt == attempts:
                raise
            print(f"download falhou ({exc}); tentativa {attempt + 1} em {10 * attempt}s")
            time.sleep(10 * attempt)
    raise AssertionError("inalcançável")


def main() -> None:
    resources = json.loads(_fetch(DATASET))["result"]["resources"]
    urls = dict(sorted((m.group(1), r["url"]) for r in resources if (m := _FILE_MONTH.search(r["url"]))))
    state = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() and "--force" not in sys.argv else {}
    months: Counts = state.get("months", {}) if state.get("by") == "accident_date" else {}
    processed: list[str] = state.get("files", []) if months else []

    for file_month, url in urls.items():
        if file_month in processed:
            continue
        with tempfile.TemporaryFile() as temp:
            temp.write(_fetch(url))
            temp.seek(0)
            merge(months, count_month(temp))
        processed.append(file_month)
        first_file = min(processed)
        complete_until = _shift(max(processed), NOTIFICATION_LAG_MONTHS)
        OUT.write_text(json.dumps({
            "source": "INSS — Comunicações de Acidente de Trabalho (CAT), dados abertos, licença CC-BY",
            "dataset": DATASET.split("id=")[1],
            "by": "accident_date",
            "files": sorted(processed),
            "complete_from": first_file,
            "complete_until": complete_until,
            "months": dict(sorted(months.items())),
        }, ensure_ascii=False), encoding="utf-8")
        print(f"arquivo {file_month} processado; série válida {first_file}–{complete_until}")
        time.sleep(1)


if __name__ == "__main__":
    main()
