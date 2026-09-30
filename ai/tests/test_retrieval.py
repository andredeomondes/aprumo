from aprumo_ai.domain import Requirement
from aprumo_ai.retrieval import BM25Retriever, ScoredRequirement, norms_of, rank_norms, select_requirements
from aprumo_ai.text import tokenize


def req(norm, item, text, revoked=False):
    return Requirement(norm=norm, item=item, text=text, revoked=revoked)


CORPUS = [
    req("NR-35", "35.1.2", "Considera-se trabalho em altura toda atividade executada acima de 2 metros do nível inferior."),
    req("NR-35", "35.5.1", "É obrigatória a utilização de sistema de proteção contra quedas no trabalho em altura."),
    req("NR-10", "10.2.8", "Nos trabalhos em instalações elétricas devem ser adotadas medidas de proteção coletiva."),
    req("NR-33", "33.3.1", "Espaço confinado é qualquer área não projetada para ocupação humana contínua."),
    req("NR-35", "35.3.1", "Programa de capacitação em altura.", revoked=True),
]


def test_tokenize_ignora_acento_stopword_e_flexao():
    assert tokenize("Instalações Elétricas") == tokenize("instalacao eletrica")
    assert "de" not in tokenize("trabalho de altura")


def test_busca_prioriza_norma_certa():
    hits = BM25Retriever(CORPUS).search("trabalho em altura com risco de queda", k=3)
    assert hits[0].requirement.norm == "NR-35"


def test_busca_exclui_revogados():
    hits = BM25Retriever(CORPUS).search("capacitação altura programa", k=5)
    assert all(not h.requirement.revoked for h in hits)


def test_busca_sem_termo_util_retorna_vazio():
    assert BM25Retriever(CORPUS).search("de a o", k=3) == []


def test_rank_norms_por_participacao_e_corte():
    hits = [
        ScoredRequirement(requirement=CORPUS[0], score=6.0),
        ScoredRequirement(requirement=CORPUS[1], score=4.0),
        ScoredRequirement(requirement=CORPUS[2], score=4.0),
        ScoredRequirement(requirement=CORPUS[3], score=0.5),
    ]
    norms = rank_norms(hits)
    assert [n.norm for n in norms] == ["NR-35", "NR-10"]
    assert norms[0].share == round(10 / 14.5, 3)


def test_select_limita_por_norma():
    hits = BM25Retriever(CORPUS).search("altura queda proteção", k=4)
    chosen = select_requirements(hits, rank_norms(hits), per_norm=1)
    assert len([r for r in chosen if r.norm == "NR-35"]) == 1


def test_norms_of_lista_normas_distintas_com_titulo():
    norms = norms_of(CORPUS[:3])
    assert [n.norm for n in norms] == ["NR-10", "NR-35"]
    assert norms[1].title == "Trabalho em Altura"
