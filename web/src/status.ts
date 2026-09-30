import type { Finding, FindingStatus } from "./types";

export const STATUS_ORDER: FindingStatus[] = ["atendido", "pendente", "nao_informado", "decisao_humana"];

export const STATUS_LABEL: Record<FindingStatus, { label: string; plural: string }> = {
  atendido: { label: "Atendido", plural: "Atendidos" },
  pendente: { label: "Pendente", plural: "Pendentes" },
  nao_informado: { label: "Não informado", plural: "Não informados" },
  decisao_humana: { label: "Decisão do profissional", plural: "Decisão do profissional" },
};

export type Relevance = "Alta" | "Média" | "Baixa";

/** Participação da norma nos itens recuperados, traduzida para a escala mostrada ao usuário. */
export function relevance(share: number): Relevance {
  if (share >= 0.45) return "Alta";
  if (share >= 0.2) return "Média";
  return "Baixa";
}

export function countByStatus(findings: Finding[]): Record<FindingStatus, number> {
  const counts: Record<FindingStatus, number> = { atendido: 0, pendente: 0, nao_informado: 0, decisao_humana: 0 };
  for (const finding of findings) counts[finding.status] += 1;
  return counts;
}
