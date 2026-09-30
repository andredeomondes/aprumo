from aprumo_ai.privacy import redact


def test_mascara_dados_pessoais():
    text = (
        "João, CPF 123.456.789-09, joao@empresa.com, (71) 99876-5432, "
        "CNPJ 12.345.678/0001-90, matrícula 88231"
    )
    out = redact(text)
    for leaked in ["123.456.789-09", "joao@empresa.com", "99876-5432", "0001-90", "88231"]:
        assert leaked not in out
    assert "[CPF]" in out and "[EMAIL]" in out and "[TELEFONE]" in out and "[CNPJ]" in out


def test_cpf_sem_pontuacao():
    assert redact("cpf 12345678909") == "cpf [CPF]"


def test_preserva_texto_tecnico():
    text = "Trabalho a 6 metros, tensão de 13.8 kV, item 35.4.5.1, 380 V, 2026"
    assert redact(text) == text
