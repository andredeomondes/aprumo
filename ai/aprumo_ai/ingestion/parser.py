import re
from collections.abc import Iterable

from aprumo_ai.domain import Requirement

_ITEM = re.compile(r"^(\d{1,2}(?:\.\d+)+)\.?\s+(\S.*)$")
_ANNEX = re.compile(r"^ANEXO\s+([IVXLC]+|\d+)\b")
_REVOKED = re.compile(r"\(Revogad[oa]", re.IGNORECASE)
_NOISE = re.compile(r"^Este texto não substitui", re.IGNORECASE)
_SPACES = re.compile(r"\s+")


def parse_norm(norm_number: int, lines: Iterable[str]) -> list[Requirement]:
    """Segmenta o texto de uma NR pelo item numerado, que é a unidade de citação.

    Linhas sem número continuam o item anterior. Números de outra norma (remissões)
    não abrem item. Repetições do mesmo item fora de anexo são sumário ou glossário,
    então vale a primeira ocorrência.
    """
    norm = f"NR-{norm_number:02d}"
    prefix = str(norm_number)
    requirements: dict[str, Requirement] = {}
    current: dict | None = None
    annex: str | None = None

    def flush() -> None:
        if current is None:
            return
        text = _SPACES.sub(" ", " ".join(current["parts"])).strip()
        requirement = Requirement(
            norm=norm,
            item=current["item"],
            annex=current["annex"],
            text=text,
            revoked=bool(_REVOKED.search(text)),
        )
        requirements.setdefault(requirement.ref, requirement)

    for raw in lines:
        line = raw.strip()
        if not line or _NOISE.match(line):
            continue
        if match := _ANNEX.match(line):
            flush()
            current, annex = None, match.group(1)
            continue
        match = _ITEM.match(line)
        if match and match.group(1).split(".")[0] == prefix:
            flush()
            current = {"item": match.group(1), "annex": annex, "parts": [match.group(2)]}
        elif current is not None:
            current["parts"].append(line)
    flush()
    return list(requirements.values())
