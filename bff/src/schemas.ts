import { z } from "zod";

// Espelha ai/aprumo_ai/domain.py. O BFF valida o que entra e o que volta do serviço de IA.

export const RequirementSchema = z.object({
  norm: z.string(),
  item: z.string(),
  annex: z.string().nullable(),
  text: z.string(),
  revoked: z.boolean(),
  ref: z.string(),
});

export const NormHitSchema = z.object({ norm: z.string(), title: z.string(), share: z.number() });

export const QuestionSectionSchema = z.enum(["planejamento", "pessoas", "controles", "execucao", "emergencia"]);
export const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  refs: z.array(z.string()),
  section: QuestionSectionSchema.default("controles"),
});

export const SectorTrendSchema = z.object({
  norm: z.string(),
  sector: z.string(),
  months: z.array(z.string()),
  values: z.array(z.number()),
  last_12m: z.number(),
  previous_12m: z.number(),
  change_pct: z.number(),
  deaths_12m: z.number(),
  forecast: z.array(z.number()),
  forecast_beats_naive: z.boolean(),
});

const AnalysisFields = {
  message: z.string(),
  norms: z.array(NormHitSchema),
  requirements: z.array(RequirementSchema),
  risk_context: z.array(SectorTrendSchema).default([]),
};

export const AnalysisSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    ...AnalysisFields,
    questions: z.array(QuestionSchema).min(10).max(12),
  }),
  z.object({
    status: z.literal("sem_base"),
    ...AnalysisFields,
    questions: z.array(QuestionSchema).max(0),
  }),
]);

export const QASchema = z.object({ question: z.string().max(1000), answer: z.string().max(2000) });

export const FindingSchema = z.object({
  ref: z.string(),
  status: z.enum(["atendido", "pendente", "nao_informado", "decisao_humana"]),
  justification: z.string(),
  // O que foi informado na conversa e a ação recomendada, separados da análise.
  evidence: z.string().max(2000).default(""),
  recommendation: z.string().max(2000).default(""),
});

export const TurnSchema = z.object({
  answered: z.boolean(),
  reply: z.string(),
  follow_up: z.string().nullable().default(null),
});

// Dados que só existem no documento: não passam pelo modelo de linguagem.
export const IdentificationSchema = z.object({
  company: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  responsible: z.string().trim().max(200).default(""),
  reviewer: z.string().trim().max(200).default(""),
});

export const ReportSchema = z.object({
  activity: z.string(),
  norms: z.array(NormHitSchema),
  findings: z.array(FindingSchema).max(60),
  requirements: z.array(RequirementSchema).max(60),
  corpus_date: z.string(),
  generated_at: z.string(),
  disclaimer: z.string(),
  risk_context: z.array(SectorTrendSchema).max(5).default([]),
  answers: z.array(QASchema).max(12).default([]),
  history_id: z.string().uuid().nullable().optional(),
  identification: IdentificationSchema.optional(),
});

export const FeedbackVerdictSchema = z.enum([
  "correto",
  "incorreto",
  "incompleto",
  "pouco_relevante",
  "pergunta_confusa",
  "faltou_pergunta",
]);

export const FeedbackTargetSchema = z.enum(["relatorio", "requisito", "pergunta"]);

export const FeedbackSchema = z.object({
  id: z.string().uuid(),
  target_type: FeedbackTargetSchema,
  target_ref: z.string().trim().min(1).max(300),
  verdict: FeedbackVerdictSchema,
  comment: z.string().trim().max(2000),
  correction: z.string().trim().max(2000),
  created_at: z.string(),
  reviewed: z.boolean(),
});

export const CreateFeedbackBody = z.object({
  target_type: FeedbackTargetSchema,
  target_ref: z.string().trim().min(1).max(300),
  verdict: FeedbackVerdictSchema,
  comment: z.string().trim().max(2000).default(""),
  correction: z.string().trim().max(2000).default(""),
});

export const HistoryRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  activity_key: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().default(null),
  revision_of: z.string().uuid().nullable().default(null),
  change_note: z.string().default("Relatório original"),
  report: ReportSchema,
  feedback: z.array(FeedbackSchema),
});

export const CreateRevisionBody = z.object({
  activity: z.string().trim().min(10).max(2000),
  change_note: z.string().trim().min(3).max(500),
  answers: z.array(QASchema).max(12),
  findings: z.array(FindingSchema).min(1).max(60),
});

export const ArchiveHistoryBody = z.object({ archived: z.boolean() });
export const DeleteHistoryBody = z.object({ confirmation: z.literal("EXCLUIR") });

export const AnalyzeBody = z.object({ activity: z.string().trim().min(10).max(2000) });

export const EvaluateBody = z.object({
  activity: z.string().trim().min(10).max(2000),
  requirements: z.array(RequirementSchema).min(1).max(30),
  answers: z.array(QASchema).max(12),
});

export const ConverseBody = z.object({
  activity: z.string().trim().min(10).max(2000),
  question: QuestionSchema,
  requirements: z.array(RequirementSchema).max(30),
  answer: z.string().trim().min(1).max(2000),
  allow_follow_up: z.boolean().default(true),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Turn = z.infer<typeof TurnSchema>;
export type ConverseBody = z.infer<typeof ConverseBody>;
export type Identification = z.infer<typeof IdentificationSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type SectorTrend = z.infer<typeof SectorTrendSchema>;
export type EvaluateBody = z.infer<typeof EvaluateBody>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type CreateFeedback = z.infer<typeof CreateFeedbackBody>;
export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;
export type CreateRevision = z.infer<typeof CreateRevisionBody>;
