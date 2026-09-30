import numpy as np
import pytest

from aprumo_ai.domain import Requirement
from aprumo_ai.embeddings import EmbeddingError, OpenAICompatibleEmbedder
from aprumo_ai.hybrid import DenseIndex, HybridRetriever
from aprumo_ai.retrieval import BM25Retriever

CORPUS = [
    Requirement(norm="NR-35", item="35.1.2", text="Trabalho em altura é toda atividade acima de 2 metros."),
    Requirement(norm="NR-10", item="10.2.8", text="Instalações elétricas exigem medidas de proteção coletiva."),
    Requirement(norm="NR-33", item="33.3.1", text="Espaço confinado não é projetado para ocupação humana contínua."),
    Requirement(norm="NR-12", item="12.1.1", text="Máquinas devem ter parada de emergência."),
]

# Vetores feitos à mão: o eixo 0 é "altura", o 1 é "eletricidade", o 2 é "confinado", o 3 é "máquina".
VECTORS = np.eye(4, dtype=np.float32)


class FakeEmbedder:
    def __init__(self, vector=None, fail=False):
        self.vector, self.fail, self.calls = vector, fail, 0

    def embed(self, texts):
        self.calls += 1
        if self.fail:
            raise EmbeddingError("fora do ar")
        return np.array([self.vector] * len(texts), dtype=np.float32)


def test_indice_denso_acha_pelo_significado():
    index = DenseIndex(CORPUS, VECTORS)
    hits = index.search(np.array([0.9, 0.1, 0, 0], dtype=np.float32), k=2)
    assert hits[0].requirement.norm == "NR-35"


def test_indice_denso_respeita_filtro_de_norma():
    index = DenseIndex(CORPUS, VECTORS)
    hits = index.search(np.array([1, 0, 0, 0], dtype=np.float32), k=2, norms={"NR-10"})
    assert {h.requirement.norm for h in hits} == {"NR-10"}


def test_indice_recusa_vetores_desalinhados():
    with pytest.raises(ValueError):
        DenseIndex(CORPUS, VECTORS[:3])


def test_hibrido_recupera_o_que_o_lexico_nao_acha():
    # "poste" não aparece em nenhum item: o BM25 não acha, o denso acha pela semântica.
    hybrid = HybridRetriever(BM25Retriever(CORPUS), DenseIndex(CORPUS, VECTORS), FakeEmbedder([1, 0, 0, 0]))
    hits = hybrid.search("troca de lâmpada no poste", k=2)
    assert hits and hits[0].requirement.norm == "NR-35"


def test_hibrido_cai_no_lexico_se_o_embedding_falhar():
    hybrid = HybridRetriever(BM25Retriever(CORPUS), DenseIndex(CORPUS, VECTORS), FakeEmbedder(fail=True))
    hits = hybrid.search("instalações elétricas proteção", k=2)
    assert hits[0].requirement.norm == "NR-10"


def test_hibrido_funde_as_duas_listas():
    # Léxico aponta NR-10, semântico aponta NR-10 também: tem de vir primeiro com folga.
    hybrid = HybridRetriever(BM25Retriever(CORPUS), DenseIndex(CORPUS, VECTORS), FakeEmbedder([0, 1, 0, 0]))
    hits = hybrid.search("instalações elétricas", k=3)
    assert hits[0].requirement.norm == "NR-10"
    assert hits[0].score > hits[1].score


def test_embedder_normaliza_e_traduz_erro():
    class Data:
        def __init__(self, embedding):
            self.embedding = embedding

    class Client:
        class embeddings:
            @staticmethod
            def create(**kwargs):
                return type("R", (), {"data": [Data([3.0, 4.0])]})()

    vectors = OpenAICompatibleEmbedder("m", dimensions=2, client=Client()).embed(["x"])
    assert np.allclose(np.linalg.norm(vectors, axis=1), 1.0)


def test_vetores_de_outro_corpus_sao_recusados(tmp_path, monkeypatch):
    import json

    from aprumo_ai.providers import retriever_from_env

    corpus = tmp_path / "corpus.json"
    corpus.write_text("{}", encoding="utf-8")
    np.save(tmp_path / "embeddings.npy", VECTORS.astype(np.float16))
    (tmp_path / "embeddings.json").write_text(json.dumps({"corpus_sha256": "outro", "count": 4}), encoding="utf-8")
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    assert isinstance(retriever_from_env(CORPUS, tmp_path), BM25Retriever)


def test_sem_chave_usa_so_bm25(tmp_path, monkeypatch):
    from aprumo_ai.providers import retriever_from_env

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert isinstance(retriever_from_env(CORPUS, tmp_path), BM25Retriever)
