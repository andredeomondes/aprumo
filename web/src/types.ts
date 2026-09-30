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
}

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
}
