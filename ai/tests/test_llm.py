import httpx2
import openai
import pytest

from aprumo_ai.llm import FallbackLLM, LLMError, OpenAICompatibleLLM
from aprumo_ai.reasoner import QueryExpansion

REQUEST = httpx2.Request("POST", "https://provedor/v1/chat/completions")


class Completion:
    def __init__(self, content):
        self.choices = [type("Choice", (), {"message": type("Message", (), {"content": content})()})()]


class FakeCompletions:
    def __init__(self, outcome):
        self.outcome, self.calls = outcome, []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return Completion(self.outcome)


class FakeOpenAI:
    def __init__(self, outcome):
        self.chat = type("Chat", (), {})()
        self.chat.completions = FakeCompletions(outcome)


def llm(outcome, **kwargs):
    return OpenAICompatibleLLM("teste", "modelo-x", client=FakeOpenAI(outcome), **kwargs)


def test_valida_json_mesmo_dentro_de_cerca_markdown():
    out = llm('```json\n{"is_work_activity": true, "terms": "trabalho em altura"}\n```').generate(
        QueryExpansion, "sistema", "prompt", max_tokens=100)
    assert out == QueryExpansion(is_work_activity=True, terms="trabalho em altura")


def test_envia_modelo_limite_e_parametros_extras():
    model = llm('{"is_work_activity": false, "terms": ""}', extra_body={"reasoning": {"enabled": False}})
    model.generate(QueryExpansion, "sistema", "prompt", max_tokens=123)
    call = model._client.chat.completions.calls[0]
    assert call["model"] == "modelo-x" and call["max_tokens"] == 123
    assert call["response_format"] == {"type": "json_object"}
    assert call["extra_body"] == {"reasoning": {"enabled": False}}
    assert "is_work_activity" in call["messages"][0]["content"]


def test_json_fora_do_formato_vira_llm_error():
    with pytest.raises(LLMError):
        llm('{"outra": 1}').generate(QueryExpansion, "s", "p", max_tokens=50)


def test_resposta_sem_json_vira_llm_error():
    with pytest.raises(LLMError):
        llm("não sei responder").generate(QueryExpansion, "s", "p", max_tokens=50)


def test_429_marca_limite_de_taxa():
    error = openai.RateLimitError("limite", response=httpx2.Response(429, request=REQUEST), body=None)
    with pytest.raises(LLMError) as caught:
        llm(error).generate(QueryExpansion, "s", "p", max_tokens=50)
    assert caught.value.rate_limited


def test_falha_de_conexao_vira_llm_error():
    with pytest.raises(LLMError) as caught:
        llm(openai.APIConnectionError(request=REQUEST)).generate(QueryExpansion, "s", "p", max_tokens=50)
    assert not caught.value.rate_limited


class Scripted:
    def __init__(self, name, outcomes):
        self.name, self.outcomes, self.calls = name, list(outcomes), 0

    def generate(self, schema, system, prompt, max_tokens):
        self.calls += 1
        outcome = self.outcomes.pop(0) if self.outcomes else self.outcomes_default
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    outcomes_default = QueryExpansion(is_work_activity=True, terms="ok")


GOOD = QueryExpansion(is_work_activity=True, terms="ok")


def test_cai_para_o_proximo_quando_o_primeiro_falha():
    first, second = Scripted("a", [LLMError("fora")]), Scripted("b", [GOOD])
    assert FallbackLLM([first, second]).generate(QueryExpansion, "s", "p", 50) == GOOD
    assert (first.calls, second.calls) == (1, 1)


def test_provedor_com_429_fica_de_fora_durante_a_pausa():
    clock = [1000.0]
    first = Scripted("a", [LLMError("limite", rate_limited=True), GOOD])
    second = Scripted("b", [GOOD, GOOD])
    chain = FallbackLLM([first, second], cooldown_seconds=60, clock=lambda: clock[0])
    chain.generate(QueryExpansion, "s", "p", 50)
    chain.generate(QueryExpansion, "s", "p", 50)
    assert first.calls == 1 and second.calls == 2
    clock[0] += 61
    chain.generate(QueryExpansion, "s", "p", 50)
    assert first.calls == 2


def test_todos_falhando_vira_llm_error():
    chain = FallbackLLM([Scripted("a", [LLMError("x")]), Scripted("b", [LLMError("y")])])
    with pytest.raises(LLMError):
        chain.generate(QueryExpansion, "s", "p", 50)


def test_registra_qual_provedor_respondeu():
    chain = FallbackLLM([Scripted("a", [LLMError("x")]), Scripted("b", [GOOD])])
    chain.generate(QueryExpansion, "s", "p", 50)
    assert chain.last_provider == "b"


class EmptyCompletion:
    choices = None


def test_resposta_200_sem_choices_vira_llm_error():
    class Client:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    return EmptyCompletion()

    with pytest.raises(LLMError):
        OpenAICompatibleLLM("vazio", "m", client=Client()).generate(QueryExpansion, "s", "p", max_tokens=50)
