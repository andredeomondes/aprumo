"""Gera o arquivo estático do front: atividades comuns, termos técnicos e o catálogo das NRs.

Uso: python -m aprumo_ai.ingestion.suggestions
Sai em web/public/suggestions.json. O filtro roda no navegador: sem latência, sem cota.
"""

import json
import re
from collections import Counter
from pathlib import Path

from aprumo_ai.domain import NORM_TITLES
from aprumo_ai.retrieval import load_corpus
from aprumo_ai.text import strip_accents

ROOT = Path(__file__).resolve().parents[3]
CORPUS = ROOT / "ai" / "data" / "corpus.json"
ACTIVITIES = ROOT / "ai" / "data" / "activities.txt"
OUT = ROOT / "web" / "public" / "suggestions.json"

_EDGE_STOPWORDS = frozenset(strip_accents(w) for w in """
a o as os um uma de da do das dos em no na nos nas ao aos à às e ou que se por para pelo pela
com sem sob sobre entre como mais deve devem ser ter este esta esse essa seu sua quando onde
nr item conforme previsto prevista não nao ainda já também todo toda todos todas cada
""".split())
# Vocabulário de redação normativa: aparece muito, não descreve atividade nem risco.
_NOISE = frozenset(strip_accents(w) for w in """
portaria alterado alterada redação retificada revogado revogada mte mtp mtb sit seprt ssst
subitem subitens anexo anexos desta deste seguinte seguintes norma regulamentadora adotadas suas seus
""".split())
_WORD = re.compile(r"[a-zà-ú]+")


def technical_terms(texts: list[str], min_count: int = 8, limit: int = 600) -> list[str]:
    """Bigramas e trigramas frequentes, sem stopword nas pontas: "permissão de trabalho"."""
    counts: Counter[str] = Counter()
    for text in texts:
        words = _WORD.findall(text.lower())
        for size in (2, 3):
            for i in range(len(words) - size + 1):
                gram = words[i:i + size]
                first, last = strip_accents(gram[0]), strip_accents(gram[-1])
                if first in _EDGE_STOPWORDS or last in _EDGE_STOPWORDS or min(len(w) for w in (gram[0], gram[-1])) < 3:
                    continue
                if any(strip_accents(w) in _NOISE for w in gram):
                    continue
                counts[" ".join(gram)] += 1
    return [term for term, count in counts.most_common(limit) if count >= min_count]


def main() -> None:
    requirements, _ = load_corpus(CORPUS)
    activities = [line.strip() for line in ACTIVITIES.read_text(encoding="utf-8").splitlines() if line.strip()]
    terms = technical_terms([r.text for r in requirements if not r.revoked])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    counts = {code: sum(r.norm == code and not r.revoked for r in requirements) for code in NORM_TITLES}
    norms = [{"code": code, "title": title, "items": counts[code]} for code, title in NORM_TITLES.items()]
    payload = {"activities": activities, "terms": terms, "norms": norms}
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"{len(activities)} atividades, {len(terms)} termos, {len(norms)} normas → {OUT}")


if __name__ == "__main__":
    main()
