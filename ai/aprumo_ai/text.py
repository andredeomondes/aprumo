import re
import unicodedata

import snowballstemmer

_STEMMER = snowballstemmer.stemmer("portuguese")


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


_STOPWORDS = frozenset(strip_accents(word) for word in """
a o as os um uma uns umas de da do das dos em no na nos nas ao aos à às e ou que se por
para pelo pela pelos pelas com sem sob sobre entre como mais menos quando onde qual quais
este esta estes estas esse essa esses essas isso isto aquele aquela seu sua seus suas
ser é são foi deve devem dever pode podem ter tem têm nesta neste desta deste nr item
""".split())


_UNACCENTED_SUFFIXES = [(re.compile(r"coes$"), "ções"), (re.compile(r"cao$"), "ção")]


def _restore_suffix(word: str) -> str:
    """Quem digita sem acento escreve 'instalacao'; o stemmer só reconhece 'instalação'."""
    for pattern, accented in _UNACCENTED_SUFFIXES:
        word = pattern.sub(accented, word)
    return word


def tokenize(text: str) -> list[str]:
    """Radical (Snowball) sobre a palavra acentuada; o acento sai depois, para casar flexões."""
    words = re.findall(r"\w+", text.lower())
    kept = [_restore_suffix(w) for w in words if len(w) > 1 and strip_accents(w) not in _STOPWORDS]
    return [strip_accents(stem) for stem in _STEMMER.stemWords(kept)]
