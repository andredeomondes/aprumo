// Espelha bff/src/schemas.ts.

export interface Requirement {
  norm: string;
  item: string;
  annex: string | null;
  text: string;
  revoked: boolean;
  ref: string;
}

export interface NormHit {
  norm: string;
  title: string;
  share: number;
}

export interface Question {
  id: string;
  text: string;
  refs: string[];
  section: QuestionSection;
}

export type QuestionSection = "planejamento" | "pessoas" | "controles" | "execucao" | "emergencia";

export interface SectorTrend {
  norm: string;
  sector: string;
  months: string[];
  values: number[];
  last_12m: number;
  previous_12m: number;
  change_pct: number;
  deaths_12m: number;
  forecast: number[];
  forecast_beats_naive: boolean;
}

export interface Analysis {
  status: "ok" | "sem_base";
  message: string;
  norms: NormHit[];
  requirements: Requirement[];
  questions: Question[];
  risk_context: SectorTrend[];
}

export interface QA {
  question: string;
  answer: string;
}

export type FindingStatus = "atendido" | "pendente" | "nao_informado" | "decisao_humana";

export interface Finding {
  ref: string;
  status: FindingStatus;
  justification: string;
  evidence?: string;
  recommendation?: string;
}

/** Uma fala do assistente depois de uma resposta: reage, tira dúvida ou aprofunda. */
export interface Turn {
  answered: boolean;
  reply: string;
  follow_up: string | null;
}

/** Dados que só existem no documento: não passam pelo modelo de linguagem. */
export interface Identification {
  company: string;
  location: string;
  responsible: string;
  reviewer: string;
}

export interface Report {
  activity: string;
  norms: NormHit[];
  findings: Finding[];
  requirements: Requirement[];
  corpus_date: string;
  generated_at: string;
  disclaimer: string;
  risk_context: SectorTrend[];
  answers: QA[];
  history_id?: string | null;
  identification?: Identification;
}

export type FeedbackVerdict =
  | "correto"
  | "incorreto"
  | "incompleto"
  | "pouco_relevante"
  | "pergunta_confusa"
  | "faltou_pergunta";

export type FeedbackTarget = "relatorio" | "requisito" | "pergunta";

export interface Feedback {
  id: string;
  target_type: FeedbackTarget;
  target_ref: string;
  verdict: FeedbackVerdict;
  comment: string;
  correction: string;
  created_at: string;
  reviewed: boolean;
}

export interface HistorySummary {
  id: string;
  version: number;
  activity: string;
  created_at: string;
  updated_at: string;
  norm_codes: string[];
  counts: Record<FindingStatus, number>;
  feedback_count: number;
  archived_at: string | null;
  revision_of: string | null;
  change_note: string;
}

export interface HistoryRecord {
  id: string;
  version: number;
  activity_key: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  revision_of: string | null;
  change_note: string;
  report: Report;
  feedback: Feedback[];
}

export interface CreateFeedback {
  target_type: FeedbackTarget;
  target_ref: string;
  verdict: FeedbackVerdict;
  comment: string;
  correction: string;
}

export interface CreateHistoryRevision {
  activity: string;
  change_note: string;
  answers: QA[];
  findings: Finding[];
}
