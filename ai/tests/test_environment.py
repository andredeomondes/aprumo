import os

from aprumo_ai.environment import load_local_environment


def test_carrega_env_local_quando_variavel_nao_existe(tmp_path, monkeypatch):
    monkeypatch.delenv("APRUMO_TEST_PROVIDER_KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("APRUMO_TEST_PROVIDER_KEY=chave-local\n", encoding="utf-8")

    assert load_local_environment(env_file)
    assert os.environ["APRUMO_TEST_PROVIDER_KEY"] == "chave-local"


def test_ambiente_externo_tem_prioridade_sobre_env_local(tmp_path, monkeypatch):
    monkeypatch.setenv("APRUMO_TEST_PROVIDER_KEY", "chave-da-producao")
    env_file = tmp_path / ".env"
    env_file.write_text("APRUMO_TEST_PROVIDER_KEY=chave-local\n", encoding="utf-8")

    assert load_local_environment(env_file)
    assert os.environ["APRUMO_TEST_PROVIDER_KEY"] == "chave-da-producao"
