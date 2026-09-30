from fastapi.testclient import TestClient

from aprumo_ai.api import create_app
from aprumo_ai.domain import Analysis
from aprumo_ai.llm import FallbackLLM, LLMError
from aprumo_ai.observability import Metrics
from aprumo_ai.reasoner import QueryExpansion
from aprumo_ai.resilience import CachingReasoner, ResilientReasoner, RuleBasedReasoner


def test_percentis_e_contadores():
    metrics = Metrics()
    for ms in range(1, 101):
        metrics.observe("POST /v1/analyze", ms / 1000)
    metrics.inc("llm", provider="groq", outcome="ok")
    metrics.inc("llm", provider="groq", outcome="ok")
    snapshot = metrics.snapshot()
    latency = snapshot["latency_ms"]["POST /v1/analyze"]
    assert latency["count"] == 100 and 45 <= latency["p50"] <= 55 and 90 <= latency["p95"] <= 100
    assert snapshot["counters"]["llm{outcome=ok,provider=groq}"] == 2


class Provider:
    def __init__(self, name, error=None):
        self.name, self.error = name, error

    def generate(self, schema, system, prompt, max_tokens):
        if self.error:
            raise self.error
        return QueryExpansion(is_work_activity=True, terms="x")


def test_cadeia_registra_resultado_por_provedor():
    metrics = Metrics()
    chain = FallbackLLM([Provider("a", LLMError("x", rate_limited=True)), Provider("b")], metrics=metrics)
    chain.generate(QueryExpansion, "s", "p", 10)
    counters = metrics.snapshot()["counters"]
    assert counters["llm{outcome=rate_limited,provider=a}"] == 1
    assert counters["llm{outcome=ok,provider=b}"] == 1


def test_cache_e_reserva_sao_contados():
    metrics = Metrics()

    class Failing:
        def expand_query(self, activity):
            from aprumo_ai.reasoner import ReasonerError
            raise ReasonerError("fora")

    reasoner = CachingReasoner(ResilientReasoner(Failing(), RuleBasedReasoner(), metrics=metrics), metrics=metrics)
    reasoner.expand_query("manutenção em prensa")
    reasoner.expand_query("manutenção em prensa")
    counters = metrics.snapshot()["counters"]
    assert counters["cache{result=miss}"] == 1 and counters["cache{result=hit}"] == 1
    assert counters["fallback_to_rules{step=expansão}"] == 1


class Service:
    def analyze(self, activity):
        return Analysis(status="sem_base", message="x")


def test_endpoint_de_metricas_exige_token_e_mede_latencia():
    metrics = Metrics()
    client = TestClient(create_app(Service(), "segredo", 1, "2026-09-30", metrics=metrics))
    client.post("/v1/analyze", json={"activity": "trabalho em altura no telhado"}, headers={"X-Internal-Token": "segredo"})
    assert client.get("/v1/metrics").status_code == 401
    body = client.get("/v1/metrics", headers={"X-Internal-Token": "segredo"}).json()
    assert body["latency_ms"]["POST /v1/analyze"]["count"] == 1
