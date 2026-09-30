from aprumo_ai.domain import QA, Finding, Question, Requirement
from aprumo_ai.reasoner import QueryExpansion
from aprumo_ai.retrieval import BM25Retriever
from aprumo_ai.service import AssessmentService

CORPUS = [
    Requirement(norm="NR-35", item="35.1.2", text="Trabalho em altura é toda atividade acima de 2 metros do nível inferior com risco de queda."),
    Requirement(norm="NR-35", item="35.5.1", text="É obrigatório sistema de proteção contra quedas no trabalho em altura."),
    Requirement(norm="NR-10", item="10.2.8", text="Em instalações elétricas devem ser adotadas medidas de proteção coletiva."),
    Requirement(norm="NR-33", item="33.3.1", text="Espaço confinado é área não projetada para ocupação humana contínua."),
    Requirement(norm="NR-12", item="12.1.1", text="Máquinas e equipamentos devem ter dispositivos de parada de emergência."),
]


class FakeReasoner:
    def __init__(self, work=True, findings=None):
        self.work, self.seen, self._findings = work, [], findings or []

    def expand_query(self, activity):
        self.seen.append(activity)
        return QueryExpansion(is_work_activity=self.work, terms="trabalho em altura queda proteção")

    def write_questions(self, activity, requirements):
        self.seen.append(activity)
        return [
            Question(id="q1", text="Há proteção contra quedas?", refs=[requirements[0].ref]),
            Question(id="q2", text="Pergunta inventada", refs=["NR-99 item 99.1"]),
        ]

    def evaluate(self, activity, requirements, answers):
        self.seen.append(activity)
        self.seen += [a.answer for a in answers]
        return self._findings


def service(reasoner, min_score=0.1):
    return AssessmentService(BM25Retriever(CORPUS), reasoner, corpus_date="2026-09-30", k=5, min_score=min_score)


def test_fora_do_dominio_nao_gera_perguntas():
    result = service(FakeReasoner(work=False)).analyze("Como faço uma receita de bolo de cenoura?")
    assert result.status == "sem_base" and result.questions == []


def test_score_baixo_vira_sem_base():
    result = service(FakeReasoner(), min_score=999).analyze("Troca de lâmpada em poste a 6 metros")
    assert result.status == "sem_base"


def test_caminho_feliz_descarta_referencia_inventada():
    result = service(FakeReasoner()).analyze("Troca de lâmpada em poste a 6 metros de altura")
    assert result.status == "ok"
    assert result.norms[0].norm == "NR-35"
    assert [q.id for q in result.questions] == ["q1"]
    assert "NR-35" in result.message


def test_anonimiza_antes_do_modelo():
    fake = FakeReasoner()
    service(fake).analyze("Técnico CPF 123.456.789-09 vai trabalhar em altura no telhado")
    assert fake.seen and all("123.456.789-09" not in s for s in fake.seen)


def test_relatorio_descarta_inventado_e_completa_faltante():
    reqs = CORPUS[:2]
    fake = FakeReasoner(findings=[
        Finding(ref=reqs[0].ref, status="atendido", justification="Informou cinto e linha de vida."),
        Finding(ref="NR-99 item 1", status="atendido", justification="inventado"),
    ])
    answers = [QA(question="Quem executa?", answer="Carlos, e-mail carlos@x.com")]
    report = service(fake).evaluate("Troca de lâmpada em altura", reqs, answers)
    statuses = {f.ref: f.status for f in report.findings}
    assert "NR-99 item 1" not in statuses
    assert statuses[reqs[1].ref] == "nao_informado"
    assert [f.ref for f in report.findings] == [r.ref for r in reqs]
    assert report.corpus_date == "2026-09-30"
    assert [n.norm for n in report.norms] == ["NR-35"]
    assert all("carlos@x.com" not in s for s in fake.seen)


class NormPickingReasoner(FakeReasoner):
    def __init__(self, norms):
        super().__init__()
        self.norms = norms

    def expand_query(self, activity):
        self.seen.append(activity)
        return QueryExpansion(is_work_activity=True, terms="trabalho em altura proteção", norms=self.norms)


def test_normas_escolhidas_pelo_modelo_limitam_a_busca():
    result = service(NormPickingReasoner(["NR-35", "NR-10"])).analyze("Troca de lâmpada em poste perto da rede")
    assert {n.norm for n in result.norms} == {"NR-35", "NR-10"}
    assert {r.norm for r in result.requirements} <= {"NR-35", "NR-10"}
    assert any(r.norm == "NR-10" for r in result.requirements), "norma menor não pode ser afogada"


def test_norma_fora_do_catalogo_e_ignorada():
    result = service(NormPickingReasoner(["NR-99", "NR-35"])).analyze("Troca de lâmpada em poste a 6 metros")
    assert {n.norm for n in result.norms} == {"NR-35"}
