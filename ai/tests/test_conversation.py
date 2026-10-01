from fastapi.testclient import TestClient

from aprumo_ai.api import create_app
from aprumo_ai.domain import Finding, Question, Requirement, Turn
from aprumo_ai.llm import LLMError
from aprumo_ai.reasoner import LLMReasoner, QueryExpansion, ReasonerError
from aprumo_ai.resilience import ResilientReasoner, RuleBasedReasoner
from aprumo_ai.retrieval import BM25Retriever
from aprumo_ai.service import AssessmentService

REQ = Requirement(norm="NR-35", item="35.5.1", text="É obrigatório sistema de proteção contra quedas no trabalho em altura.")
OTHER = Requirement(norm="NR-10", item="10.2.8", text="Em instalações elétricas devem ser adotadas medidas de proteção coletiva.")
QUESTION = Question(id="q1", text="Há sistema de proteção contra quedas instalado?", refs=[REQ.ref])


class FakeLLM:
    name = "fake"

    def __init__(self, output=None, error=None):
        self.output, self.error, self.calls = output, error, []

    def generate(self, schema, system, prompt, max_tokens):
        self.calls.append({"schema": schema, "prompt": prompt, "max_tokens": max_tokens})
        if self.error:
            raise self.error
        return self.output


def test_turno_leva_pergunta_item_e_resposta_ao_modelo():
    llm = FakeLLM(Turn(answered=True, reply="Certo, linha de vida instalada.", follow_up=None))
    turn = LLMReasoner(llm).converse("Troca de lâmpada em poste", QUESTION, [REQ], "Sim, com linha de vida", True)
    assert turn.reply == "Certo, linha de vida instalada."
    prompt = llm.calls[0]["prompt"]
    assert QUESTION.text in prompt and "Sim, com linha de vida" in prompt and REQ.ref in prompt
    assert llm.calls[0]["max_tokens"] <= 400


def test_modelo_fora_do_ar_vira_reasoner_error_no_turno():
    try:
        LLMReasoner(FakeLLM(error=LLMError("fora"))).converse("x", QUESTION, [REQ], "Sim", True)
    except ReasonerError:
        return
    raise AssertionError("deveria levantar ReasonerError")


def test_regras_aprofundam_resposta_negativa_uma_vez():
    rules = RuleBasedReasoner()
    negative = rules.converse("x", QUESTION, [REQ], "Não", True)
    assert negative.answered and negative.follow_up
    assert rules.converse("x", QUESTION, [REQ], "Não", False).follow_up is None
    assert rules.converse("x", QUESTION, [REQ], "Sim, instalado e inspecionado", True).follow_up is None


def test_conversa_continua_com_regras_quando_o_modelo_cai():
    class Failing:
        def converse(self, *args):
            raise ReasonerError("fora")

    turn = ResilientReasoner(Failing(), RuleBasedReasoner()).converse("x", QUESTION, [REQ], "Não sei", True)
    assert turn.answered and turn.reply


class RecordingReasoner:
    def __init__(self, turn):
        self.turn, self.seen = turn, {}

    def expand_query(self, activity):
        return QueryExpansion(is_work_activity=True, terms="trabalho em altura queda",
                              understanding="Entendi: troca de lâmpada em poste, com risco de queda.")

    def write_questions(self, activity, requirements):
        return [Question(id="q1", text="Há proteção contra quedas?", refs=[requirements[0].ref])]

    def evaluate(self, activity, requirements, answers):
        return [Finding(ref=requirements[0].ref, status="pendente", justification="Sem linha de vida.",
                        evidence="Informou que não há linha de vida.", recommendation="Instalar linha de vida.")]

    def converse(self, activity, question, requirements, answer, allow_follow_up):
        self.seen = {"activity": activity, "answer": answer, "refs": [r.ref for r in requirements],
                     "allow": allow_follow_up}
        return self.turn


FILLER = [
    Requirement(norm="NR-33", item="33.3.1", text="Espaço confinado é área não projetada para ocupação humana contínua."),
    Requirement(norm="NR-12", item="12.1.1", text="Máquinas e equipamentos devem ter dispositivos de parada de emergência."),
]


def service(reasoner):
    corpus = [REQ, OTHER, *FILLER]
    return AssessmentService(BM25Retriever(corpus), reasoner, corpus_date="2026-09-30", k=5, min_score=0.1)


def test_servico_anonimiza_e_manda_so_os_itens_da_pergunta():
    reasoner = RecordingReasoner(Turn(answered=True, reply="Certo."))
    service(reasoner).converse("Poste, técnico CPF 123.456.789-09", QUESTION, [REQ, OTHER],
                               "Sim, fale com joao@x.com", allow_follow_up=True)
    assert "123.456.789-09" not in reasoner.seen["activity"]
    assert "joao@x.com" not in reasoner.seen["answer"]
    assert reasoner.seen["refs"] == [REQ.ref]


def test_servico_limita_o_tamanho_da_fala_do_modelo():
    reasoner = RecordingReasoner(Turn(answered=True, reply="x" * 2000, follow_up="y" * 2000))
    turn = service(reasoner).converse("Troca de lâmpada em poste", QUESTION, [REQ], "Sim", allow_follow_up=True)
    assert len(turn.reply) <= 600 and len(turn.follow_up) <= 300


def test_abertura_usa_o_entendimento_do_modelo():
    analysis = service(RecordingReasoner(Turn())).analyze("Troca de lâmpada em poste a 6 metros de altura")
    assert analysis.message.startswith("Entendi: troca de lâmpada em poste")
    assert "NR-35" in analysis.message


def test_relatorio_carrega_evidencia_e_recomendacao():
    report = service(RecordingReasoner(Turn())).evaluate("Troca de lâmpada em altura", [REQ], [])
    finding = report.findings[0]
    assert finding.evidence.startswith("Informou") and finding.recommendation == "Instalar linha de vida."


def test_endpoint_de_conversa_exige_token_e_devolve_o_turno():
    class Service:
        def converse(self, activity, question, requirements, answer, allow_follow_up):
            return Turn(answered=False, reply="SPIQ é o sistema de proteção individual contra quedas.")

    client = TestClient(create_app(Service(), "segredo", 1, "2026-09-30"))
    body = {"activity": "Troca de lâmpada em poste", "question": QUESTION.model_dump(),
            "requirements": [REQ.model_dump()], "answer": "O que é SPIQ?", "allow_follow_up": True}
    assert client.post("/v1/converse", json=body).status_code == 401
    response = client.post("/v1/converse", json=body, headers={"X-Internal-Token": "segredo"})
    assert response.status_code == 200 and response.json()["answered"] is False


def test_duvida_nao_gera_aprofundamento():
    reasoner = RecordingReasoner(Turn(answered=False, reply="É o conjunto que impede a queda.", follow_up="Quem montou?"))
    turn = service(reasoner).converse("Troca de lâmpada em poste", QUESTION, [REQ], "o que é isso?", allow_follow_up=True)
    assert turn.answered is False and turn.follow_up is None


def test_nao_sei_segue_em_frente_mesmo_se_o_modelo_quiser_aprofundar():
    reasoner = RecordingReasoner(Turn(answered=True, reply="Anotado.", follow_up="Quem define?"))
    turn = service(reasoner).converse("Troca de lâmpada em poste", QUESTION, [REQ], "Não sei.", allow_follow_up=True)
    assert turn.follow_up is None


def test_complemento_do_aprofundamento_sempre_conta_como_resposta():
    reasoner = RecordingReasoner(Turn(answered=False, reply="Confirme a pergunta original."))
    turn = service(reasoner).converse("Troca de lâmpada em poste", QUESTION, [REQ], "O Paulo faz até amanhã", allow_follow_up=False)
    assert turn.answered is True and turn.follow_up is None
