"""Composição do serviço a partir do ambiente. Uso: uvicorn aprumo_ai.main:app"""

import os
from pathlib import Path

import anthropic

from aprumo_ai.api import create_app
from aprumo_ai.reasoner import ClaudeReasoner
from aprumo_ai.retrieval import BM25Retriever, load_corpus
from aprumo_ai.service import AssessmentService

CORPUS = Path(__file__).resolve().parents[1] / "data" / "corpus.json"

requirements, corpus_date = load_corpus(CORPUS)
service = AssessmentService(
    retriever=BM25Retriever(requirements),
    reasoner=ClaudeReasoner(anthropic.Anthropic(), os.environ.get("APRUMO_MODEL", "claude-opus-5-5")),
    corpus_date=corpus_date,
    min_score=float(os.environ.get("APRUMO_MIN_SCORE", "1.0")),
)
app = create_app(service, os.environ["APRUMO_INTERNAL_TOKEN"], len(requirements), corpus_date)
