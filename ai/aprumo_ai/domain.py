from typing import Literal

from pydantic import BaseModel, Field, computed_field

NORM_TITLES: dict[str, str] = {
    "NR-01": "Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
    "NR-06": "Equipamento de Proteção Individual",
    "NR-09": "Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos",
    "NR-10": "Segurança em Instalações e Serviços em Eletricidade",
    "NR-11": "Transporte, Movimentação, Armazenagem e Manuseio de Materiais",
    "NR-12": "Segurança no Trabalho em Máquinas e Equipamentos",
    "NR-13": "Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento",
    "NR-17": "Ergonomia",
    "NR-18": "Segurança e Saúde no Trabalho na Indústria da Construção",
    "NR-20": "Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis",
    "NR-23": "Proteção Contra Incêndios",
    "NR-26": "Sinalização e Identificação de Segurança",
    "NR-33": "Segurança e Saúde nos Trabalhos em Espaços Confinados",
    "NR-35": "Trabalho em Altura",
}

DISCLAIMER = (
    "Relatório de apoio gerado automaticamente. Não é laudo nem parecer técnico, "
    "não substitui profissional habilitado nem a leitura da norma."
)

Status = Literal["atendido", "pendente", "nao_informado", "decisao_humana"]


class Requirement(BaseModel):
    """Um item numerado de uma NR: a unidade de recuperação e de citação."""

    norm: str
    item: str
    annex: str | None = None
    text: str
    revoked: bool = False

    @computed_field
    @property
    def ref(self) -> str:
        annex = f" anexo {self.annex}" if self.annex else ""
        return f"{self.norm}{annex} item {self.item}"


class NormHit(BaseModel):
    norm: str
    title: str
    share: float


class Question(BaseModel):
    id: str
    text: str
    refs: list[str]


class Analysis(BaseModel):
    status: Literal["ok", "sem_base"]
    message: str
    norms: list[NormHit] = []
    requirements: list[Requirement] = []
    questions: list[Question] = []


class QA(BaseModel):
    question: str = Field(max_length=1000)
    answer: str = Field(max_length=2000)


class Finding(BaseModel):
    ref: str
    status: Status
    justification: str


class Report(BaseModel):
    activity: str
    norms: list[NormHit]
    findings: list[Finding]
    requirements: list[Requirement]
    corpus_date: str
    generated_at: str
    disclaimer: str = DISCLAIMER
