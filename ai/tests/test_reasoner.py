import anthropic
import httpx2
import pytest

from aprumo_ai.domain import Question, Requirement
from aprumo_ai.reasoner import ClaudeReasoner, ReasonerError, _Questions


class Response:
    def __init__(self, stop_reason="end_turn", parsed_output=None):
        self.stop_reason = stop_reason
        self.parsed_output = parsed_output


class FakeMessages:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.calls = response, error, []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


class FakeBeta:
    def __init__(self, messages):
        self.messages = messages


class FakeClient:
    def __init__(self, messages):
        self.beta = FakeBeta(messages)


REQ = Requirement(norm="NR-35", item="35.5.1", text="Sistema de proteção contra quedas.")


def test_recusa_vira_reasoner_error():
    client = FakeClient(FakeMessages(Response(stop_reason="refusal")))
    with pytest.raises(ReasonerError):
        ClaudeReasoner(client, "claude-opus-5-5").expand_query("trabalho em altura")


def test_erro_de_api_vira_reasoner_error():
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    client = FakeClient(FakeMessages(error=anthropic.APIConnectionError(request=request)))
    with pytest.raises(ReasonerError):
        ClaudeReasoner(client, "claude-opus-5-5").expand_query("trabalho em altura")


def test_perguntas_levam_itens_no_prompt_e_modelo_configurado():
    parsed = _Questions(questions=[Question(id="q1", text="Há linha de vida?", refs=[REQ.ref])])
    messages = FakeMessages(Response(parsed_output=parsed))
    questions = ClaudeReasoner(FakeClient(messages), "claude-opus-5-5").write_questions("Poste a 7 m", [REQ])
    assert questions[0].refs == ["NR-35 item 35.5.1"]
    call = messages.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default"
    assert "[NR-35 item 35.5.1] Sistema de proteção contra quedas." in call["messages"][0]["content"]
