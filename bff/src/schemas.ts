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

export const QuestionSchema = z.object({ id: z.string(), text: z.string(), refs: z.array(z.string()) });

export const AnalysisSchema = z.object({
  status: z.enum(["ok", "sem_base"]),
  message: z.string(),
  norms: z.array(NormHitSchema),
  requirements: z.array(RequirementSchema),
  questions: z.array(QuestionSchema),
});

export const QASchema = z.object({ question: z.string().max(1000), answer: z.string().max(2000) });

export const FindingSchema = z.object({
  ref: z.string(),
  status: z.enum(["atendido", "pendente", "nao_informado", "decisao_humana"]),
  justification: z.string(),
});

export const ReportSchema = z.object({
  activity: z.string(),
  norms: z.array(NormHitSchema),
  findings: z.array(FindingSchema).max(60),
  requirements: z.array(RequirementSchema).max(60),
  corpus_date: z.string(),
  generated_at: z.string(),
  disclaimer: z.string(),
});

export const AnalyzeBody = z.object({ activity: z.string().trim().min(10).max(2000) });

export const EvaluateBody = z.object({
  activity: z.string().trim().min(10).max(2000),
  requirements: z.array(RequirementSchema).min(1).max(30),
  answers: z.array(QASchema).max(12),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type EvaluateBody = z.infer<typeof EvaluateBody>;
