import re

# A ordem importa: o padrão de CPF casaria com um pedaço do CNPJ.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("[EMAIL]", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("[CNPJ]", re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")),
    ("[CPF]", re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")),
    ("[TELEFONE]", re.compile(r"(?:\(?\b\d{2}\)?\s?)?\b9?\d{4}-\d{4}\b")),
    ("[MATRICULA]", re.compile(r"(?i)\bmatr[ií]cula\s*:?\s*\d+")),
]


def redact(text: str) -> str:
    """Mascara dado pessoal antes de qualquer chamada a modelo externo."""
    for label, pattern in _PATTERNS:
        text = pattern.sub(label, text)
    return text
