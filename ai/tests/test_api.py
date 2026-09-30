from fastapi.testclient import TestClient

from aprumo_ai.api import create_app
from aprumo_ai.domain import Analysis, Report
from aprumo_ai.reasoner import ReasonerError

REQUIREMENT = {"norm": "NR-35", "item": "35.5.1", "annex": None, "text": "x", "revoked": False,
               "ref": "NR-35 item 35.5.1"}


class FakeService:
    def __init__(self, fail=False):
        self.fail = fail
        self.evaluated = None

    def analyze(self, activity):
        if self.fail:
            raise ReasonerError("fora do ar")
        return Analysis(status="sem_base", message="x")

    def evaluate(self, activity, requirements, answers):
        self.evaluated = requirements
        return Report(activity=activity, norms=[], findings=[], requirements=requirements,
                      corpus_date="2026-09-30", generated_at="2026-09-30T20:00:00+00:00")


H = {"X-Internal-Token": "segredo"}
ACTIVITY = {"activity": "trabalho em altura no telhado"}


def client(service=None):
    app = create_app(service or FakeService(), "segredo", requirement_count=3, corpus_date="2026-09-30")
    return TestClient(app)


def test_health_publico():
    body = client().get("/health").json()
    assert body["requirements"] == 3 and body["corpus_date"] == "2026-09-30"


def test_exige_token():
    assert client().post("/v1/analyze", json=ACTIVITY).status_code == 401
    assert client().post("/v1/analyze", json=ACTIVITY, headers={"X-Internal-Token": "errado"}).status_code == 401


def test_valida_tamanho():
    assert client().post("/v1/analyze", json={"activity": "oi"}, headers=H).status_code == 422


def test_erro_do_modelo_vira_502():
    response = client(FakeService(fail=True)).post("/v1/analyze", json=ACTIVITY, headers=H)
    assert response.status_code == 502 and "detail" in response.json()


def test_evaluate_aceita_requisito_com_ref_devolvido_pelo_proprio_servico():
    service = FakeService()
    body = {**ACTIVITY, "requirements": [REQUIREMENT], "answers": [{"question": "q", "answer": "a"}]}
    response = client(service).post("/v1/evaluate", json=body, headers=H)
    assert response.status_code == 200
    assert service.evaluated[0].ref == "NR-35 item 35.5.1"
