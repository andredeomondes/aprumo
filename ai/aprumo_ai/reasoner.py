from typing import Protocol

from pydantic import BaseModel

from aprumo_ai.domain import QA, Finding, Question, Requirement


class QueryExpansion(BaseModel):
    is_work_activity: bool
    terms: str


class ReasonerError(Exception):
    """Falha do provedor de linguagem: indisponível, recusa ou resposta inválida."""


class Reasoner(Protocol):
    def expand_query(self, activity: str) -> QueryExpansion: ...

    def write_questions(self, activity: str, requirements: list[Requirement]) -> list[Question]: ...

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> list[Finding]: ...
