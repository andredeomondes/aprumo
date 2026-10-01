"""Carrega configuração local sem substituir variáveis fornecidas pelo ambiente."""

from pathlib import Path

from dotenv import load_dotenv


def load_local_environment(path: Path | None = None) -> bool:
    """Lê o `.env` do serviço em desenvolvimento; produção continua soberana."""
    env_file = path or Path(__file__).resolve().parents[1] / ".env"
    return load_dotenv(env_file, override=False)
