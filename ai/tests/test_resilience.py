from aprumo_ai.domain import QA, Finding, Question, Requirement
from aprumo_ai.reasoner import QueryExpansion, ReasonerError
from aprumo_ai.resilience import CachingReasoner, ResilientReasoner, RuleBasedReasoner

REQS = [
    Requirement(norm="NR-35", item="35.5.1", text="Sistema de proteção contra quedas no trabalho em altura."),
    Requirement(norm="NR-10", item="10.5.1", text="Desenergização antes de intervir em instalações elétricas."),
]


def test_regras_reconhecem_atividade_e_traduzem_termos():
    expansion = RuleBasedReasoner().expand_query("Troca de luminária em poste perto da rede elétrica")
    assert expansion.is_work_activity
    assert "altura" in expansion.terms and "instalações elétricas" in expansion.terms


def test_regras_recusam_fora_do_dominio():
    assert not RuleBasedReasoner().expand_query("Como faço uma receita de bolo de cenoura?").is_work_activity


def test_regras_perguntam_sobre_cada_item_citando_a_ref():
    questions = RuleBasedReasoner().write_questions("poste", REQS)
    assert 10 <= len(questions) <= 12
    assert {ref for question in questions for ref in question.refs} == {REQS[0].ref, REQS[1].ref}
    assert [question.section for question in questions] == sorted(
        [question.section for question in questions],
        key=["planejamento", "pessoas", "controles", "execucao", "emergencia"].index,
    )


def test_regras_devolvem_decisao_ao_profissional():
    findings = RuleBasedReasoner().evaluate("poste", REQS, [QA(question="q", answer="a")])
    assert {f.status for f in findings} == {"decisao_humana"}


class Failing:
    def expand_query(self, activity):
        raise ReasonerError("fora")

    def write_questions(self, activity, requirements):
        raise ReasonerError("fora")

    def evaluate(self, activity, requirements, answers):
        raise ReasonerError("fora")


def test_resiliente_usa_o_reserva_quando_o_principal_falha():
    reasoner = ResilientReasoner(Failing(), RuleBasedReasoner())
    assert reasoner.expand_query("manutenção em prensa").is_work_activity
    assert reasoner.write_questions("prensa", REQS)
    assert reasoner.evaluate("prensa", REQS, [])[0].status == "decisao_humana"


class Counting:
    def __init__(self):
        self.calls = 0

    def expand_query(self, activity):
        self.calls += 1
        return QueryExpansion(is_work_activity=True, terms="altura")

    def write_questions(self, activity, requirements):
        self.calls += 1
        return [Question(id="q1", text="?", refs=[requirements[0].ref])]

    def evaluate(self, activity, requirements, answers):
        self.calls += 1
        return [Finding(ref=requirements[0].ref, status="atendido", justification="ok")]


def test_cache_evita_chamada_repetida():
    inner = Counting()
    cached = CachingReasoner(inner)
    for _ in range(3):
        cached.expand_query("Troca de luminária")
        cached.write_questions("Troca de luminária", REQS)
        cached.evaluate("Troca de luminária", REQS, [QA(question="q", answer="a")])
    assert inner.calls == 3


def test_cache_diferencia_respostas():
    inner = Counting()
    cached = CachingReasoner(inner)
    cached.evaluate("x", REQS, [QA(question="q", answer="sim")])
    cached.evaluate("x", REQS, [QA(question="q", answer="não")])
    assert inner.calls == 2


def test_cache_descarta_o_mais_antigo():
    inner = Counting()
    cached = CachingReasoner(inner, max_entries=2)
    for text in ["a", "b", "c", "a"]:
        cached.expand_query(text)
    assert inner.calls == 4


def test_regras_tambem_escolhem_normas():
    expansion = RuleBasedReasoner().expand_query("Operação de empilhadeira e troca de luminária em poste")
    assert {"NR-11", "NR-35"} <= set(expansion.norms)
