import pytest

from aprumo_ai.domain import QA, Finding, Question, Requirement
from aprumo_ai.llm import LLMError
from aprumo_ai.reasoner import LLMReasoner, QueryExpansion, ReasonerError, _Findings, _Questions

REQ = Requirement(norm="NR-35", item="35.5.1", text="Sistema de proteção contra quedas. " + "x" * 800)


class FakeLLM:
    name = "fake"

    def __init__(self, output=None, error=None):
        self.output, self.error, self.calls = output, error, []

    def generate(self, schema, system, prompt, max_tokens):
        self.calls.append({"schema": schema, "system": system, "prompt": prompt, "max_tokens": max_tokens})
        if self.error:
            raise self.error
        return self.output


def test_falha_do_modelo_vira_reasoner_error():
    with pytest.raises(ReasonerError):
        LLMReasoner(FakeLLM(error=LLMError("fora"))).expand_query("trabalho em altura")


def test_expansao_usa_limite_curto():
    llm = FakeLLM(QueryExpansion(is_work_activity=True, terms="altura"))
    assert LLMReasoner(llm).expand_query("poste").terms == "altura"
    assert llm.calls[0]["max_tokens"] <= 400


def test_perguntas_levam_itens_resumidos_no_prompt():
    llm = FakeLLM(_Questions(questions=[Question(id="q1", text="Há linha de vida?", refs=[REQ.ref])]))
    questions = LLMReasoner(llm).write_questions("Poste a 7 m", [REQ])
    assert questions[0].refs == ["NR-35 item 35.5.1"]
    prompt = llm.calls[0]["prompt"]
    assert "[NR-35 item 35.5.1] Sistema de proteção contra quedas." in prompt
    assert "10 a 12 perguntas" in prompt
    assert "section (planejamento | pessoas | controles | execucao | emergencia)" in prompt
    assert len(prompt) < 1500, "texto do item deve ser cortado para economizar tokens"


def test_avaliacao_inclui_respostas():
    llm = FakeLLM(_Findings(findings=[Finding(ref=REQ.ref, status="atendido", justification="ok")]))
    LLMReasoner(llm).evaluate("Poste", [REQ], [QA(question="Linha de vida?", answer="Sim, instalada")])
    assert "R: Sim, instalada" in llm.calls[0]["prompt"]
