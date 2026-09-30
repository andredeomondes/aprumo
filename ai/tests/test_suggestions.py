from aprumo_ai.ingestion.suggestions import technical_terms

TEXTS = [
    "A permissão de trabalho deve ser emitida antes do trabalho em altura.",
    "Sem permissão de trabalho não se inicia o trabalho em altura.",
    "A permissão de trabalho e a análise de risco ficam arquivadas.",
    "A análise de risco precede o trabalho em altura.",
]


def test_extrai_termos_frequentes_sem_stopword_nas_pontas():
    terms = technical_terms(TEXTS, min_count=2)
    assert "permissão de trabalho" in terms
    assert "trabalho em altura" in terms
    assert "análise de risco" in terms
    assert all(not t.startswith(("a ", "de ", "o ")) and not t.endswith((" a", " de", " o")) for t in terms)


def test_ordena_por_frequencia_e_respeita_minimo():
    terms = technical_terms(TEXTS, min_count=3)
    assert terms[0] in {"permissão de trabalho", "trabalho em altura"}
    assert "análise de risco" not in terms


def test_descarta_ruido_de_redacao_normativa():
    texts = ["Alterado pela Portaria MTE nº 1. Os seguintes requisitos desta norma e seus subitens."] * 10
    assert technical_terms(texts, min_count=2) == []
