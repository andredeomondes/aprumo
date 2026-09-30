"""Baixa o texto vigente de cada NR a partir das páginas oficiais do MTE.

Uso: python -m aprumo_ai.ingestion.download [--force]
Cada NR tem uma página própria; o PDF baixado é o do texto consolidado (link rotulado
"NR-X - TÍTULO"), nunca uma portaria de alteração. Normas já baixadas são mantidas, salvo --force.
"""

import re
import ssl
import sys
import time
import urllib.request
from pathlib import Path

import certifi

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
BASE = (
    "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/"
    "conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/"
    "normas-regulamentadoras-vigentes/"
)
# NR-02 e NR-27 foram revogadas; a página da NR-37 fica em outro caminho.
VIGENTES = [n for n in range(1, 39) if n not in (2, 27)]
PAGE = {1: BASE + "nr-1", 37: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/"
        "seguranca-e-saude-no-trabalho/ctpp-nrs/norma-regulamentadora-no-37-nr-37"}
HEADERS = {"User-Agent": "Mozilla/5.0 (aprumo ingestion)"}


_SSL = ssl.create_default_context(cafile=certifi.where())


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=60, context=_SSL) as response:
        return response.read()


def pdf_link(number: int, html: str) -> str | None:
    """O texto consolidado é o link rotulado "NR-5 - TÍTULO"; portarias de alteração e anexos
    avulsos ficam de fora. Sem rótulo, vale o arquivo nomeado nr-05-atualizada-AAAA."""
    anchors = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
    label = re.compile(rf"^NR[-\s]*0?{number}\s*[-–]", re.IGNORECASE)
    for href, text in anchors:
        text = re.sub(r"<[^>]+>", "", text).strip()
        if label.match(text) and "anexo" not in text.lower() and ".pdf" in href.lower():
            return href.removesuffix("/view")
    named = re.compile(rf"/nr[-_]?0?{number}(?:[-_]atualizada[^/]*)?\.pdf", re.IGNORECASE)
    for href, _ in anchors:
        if named.search(href):
            return href.removesuffix("/view")
    return None


def main() -> None:
    force = "--force" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    for number in VIGENTES:
        target = RAW / f"nr-{number:02d}.pdf"
        if target.exists() and not force:
            continue
        page = PAGE.get(number, BASE + f"norma-regulamentadora-no-{number}-nr-{number}")
        try:
            link = pdf_link(number, fetch(page).decode("utf-8", errors="ignore"))
            if not link:
                print(f"NR-{number:02d}: PDF não encontrado em {page}")
                continue
            data = fetch(link)
            if not data.startswith(b"%PDF"):
                print(f"NR-{number:02d}: resposta não é PDF ({link})")
                continue
            target.write_bytes(data)
            print(f"NR-{number:02d}: {len(data) // 1024} KB ← {link.rsplit('/', 1)[-1]}")
        except OSError as exc:
            print(f"NR-{number:02d}: falhou ({exc})")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
