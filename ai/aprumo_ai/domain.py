from typing import Literal

from pydantic import BaseModel, Field, computed_field

from aprumo_ai.accidents.trends import SectorTrend

NORM_TITLES: dict[str, str] = {
    "NR-01": "Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
    "NR-03": "Embargo e Interdição",
    "NR-04": "Serviços Especializados em Segurança e em Medicina do Trabalho",
    "NR-05": "Comissão Interna de Prevenção de Acidentes e de Assédio",
    "NR-06": "Equipamento de Proteção Individual",
    "NR-07": "Programa de Controle Médico de Saúde Ocupacional",
    "NR-08": "Edificações",
    "NR-09": "Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos",
    "NR-10": "Segurança em Instalações e Serviços em Eletricidade",
    "NR-11": "Transporte, Movimentação, Armazenagem e Manuseio de Materiais",
    "NR-12": "Segurança no Trabalho em Máquinas e Equipamentos",
    "NR-13": "Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento",
    "NR-14": "Fornos",
    "NR-15": "Atividades e Operações Insalubres",
    "NR-16": "Atividades e Operações Perigosas",
    "NR-17": "Ergonomia",
    "NR-18": "Segurança e Saúde no Trabalho na Indústria da Construção",
    "NR-19": "Explosivos",
    "NR-20": "Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis",
    "NR-21": "Trabalhos a Céu Aberto",
    "NR-22": "Segurança e Saúde Ocupacional na Mineração",
    "NR-23": "Proteção Contra Incêndios",
    "NR-24": "Condições Sanitárias e de Conforto nos Locais de Trabalho",
    "NR-25": "Resíduos Industriais",
    "NR-26": "Sinalização e Identificação de Segurança",
    "NR-28": "Fiscalização e Penalidades",
    "NR-29": "Segurança e Saúde no Trabalho Portuário",
    "NR-30": "Segurança e Saúde no Trabalho Aquaviário",
    "NR-31": "Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura",
    "NR-32": "Segurança e Saúde no Trabalho em Serviços de Saúde",
    "NR-33": "Segurança e Saúde nos Trabalhos em Espaços Confinados",
    "NR-34": "Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval",
    "NR-35": "Trabalho em Altura",
    "NR-36": "Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados",
    "NR-37": "Segurança e Saúde em Plataformas de Petróleo",
    "NR-38": "Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos",
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


QuestionSection = Literal["planejamento", "pessoas", "controles", "execucao", "emergencia"]


class Question(BaseModel):
    id: str
    text: str
    refs: list[str]
    section: QuestionSection = "controles"


class Analysis(BaseModel):
    status: Literal["ok", "sem_base"]
    message: str
    norms: list[NormHit] = []
    requirements: list[Requirement] = []
    questions: list[Question] = []
    risk_context: list[SectorTrend] = []


class QA(BaseModel):
    question: str = Field(max_length=1000)
    answer: str = Field(max_length=2000)


class Finding(BaseModel):
    """Um requisito avaliado. `justification` é a análise, `evidence` é o que foi informado na
    conversa e `recommendation` é a ação recomendada. Ficam separados porque um relatório
    técnico precisa distinguir o que foi dito do que foi concluído."""

    ref: str
    status: Status
    justification: str
    evidence: str = ""
    recommendation: str = ""


class Turn(BaseModel):
    """Uma fala do assistente depois de uma resposta: reage, tira dúvida ou aprofunda."""

    answered: bool = True
    reply: str = ""
    follow_up: str | None = None


class Report(BaseModel):
    activity: str
    norms: list[NormHit]
    findings: list[Finding]
    requirements: list[Requirement]
    corpus_date: str
    generated_at: str
    disclaimer: str = DISCLAIMER
    risk_context: list[SectorTrend] = []
    answers: list[QA] = []
