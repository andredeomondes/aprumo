"""Composição do serviço a partir do ambiente. Uso: uvicorn aprumo_ai.main:app"""

import logging
import os
from pathlib import Path

from aprumo_ai.accidents.trends import TrendService
from aprumo_ai.api import create_app
from aprumo_ai.environment import load_local_environment
from aprumo_ai.llm import FallbackLLM
from aprumo_ai.providers import providers_from_env, retriever_from_env
from aprumo_ai.reasoner import LLMReasoner
from aprumo_ai.resilience import CachingReasoner, ResilientReasoner, RuleBasedReasoner
from aprumo_ai.retrieval import load_corpus
from aprumo_ai.service import AssessmentService

logging.basicConfig(level=logging.INFO)

# `uvicorn aprumo_ai.main:app` agora funciona no desenvolvimento mesmo quando
# quem iniciou o processo esqueceu `--env-file .env`.
load_local_environment()

CORPUS = Path(__file__).resolve().parents[1] / "data" / "corpus.json"


requirements, corpus_date = load_corpus(CORPUS)
reasoner = CachingReasoner(ResilientReasoner(LLMReasoner(FallbackLLM(providers_from_env())), RuleBasedReasoner()))
service = AssessmentService(
    retriever=retriever_from_env(requirements, CORPUS.parent),
    reasoner=reasoner,
    corpus_date=corpus_date,
    min_score=float(os.environ.get("APRUMO_MIN_SCORE", "1.0")),
    trends=TrendService.from_file(CORPUS.parent / "accidents.json"),
)
app = create_app(service, os.environ["APRUMO_INTERNAL_TOKEN"], len(requirements), corpus_date)
