from aprumo_ai.contracts import OUT, render


def test_exemplos_do_contrato_estao_atualizados():
    for name, text in render().items():
        path = OUT / name
        assert path.exists(), f"rode python -m aprumo_ai.contracts ({name} ausente)"
        assert path.read_text(encoding="utf-8") == text, f"contracts/{name} desatualizado: rode python -m aprumo_ai.contracts"
