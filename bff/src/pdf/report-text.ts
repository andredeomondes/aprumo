import { createHash } from "node:crypto";
import type { Finding, Report } from "../schemas.js";

type Status = Finding["status"];

export const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  decisao_humana: "Decisão do profissional",
  nao_informado: "Não informado",
  atendido: "Atendido",
};

/** Ordem de leitura: primeiro o que impede a atividade, por último o que está em ordem. */
export const STATUS_ORDER: Status[] = ["pendente", "decisao_humana", "nao_informado", "atendido"];

/** Ação usada quando a avaliação não trouxe recomendação específica para o item. */
export const DEFAULT_ACTION: Record<Status, string> = {
  pendente: "Corrigir antes da execução e registrar a evidência da medida adotada.",
  decisao_humana: "Submeter ao profissional responsável e registrar a decisão com a justificativa.",
  nao_informado: "Levantar a informação no local ou com o responsável e complementar a conferência.",
  atendido: "Manter o controle e arquivar a evidência que sustenta o atendimento.",
};

export function countByStatus(report: Report): Record<Status, number> {
  const counts: Record<Status, number> = { pendente: 0, decisao_humana: 0, nao_informado: 0, atendido: 0 };
  for (const finding of report.findings) counts[finding.status] += 1;
  return counts;
}

/** AP-AAAAMMDD-XXXXXXXX: data de emissão mais o início do identificador do histórico. */
export function reportNumber(report: Report): string {
  const date = report.generated_at.slice(0, 10).replaceAll("-", "");
  const source = report.history_id ?? createHash("sha256").update(`${report.generated_at}${report.activity}`).digest("hex");
  return `AP-${date}-${source.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Conclusão montada por regra, a partir das contagens. É o parágrafo mais sensível do
 * documento, então não fica a cargo do modelo de linguagem: o mesmo resultado gera sempre o
 * mesmo texto, e ele nunca libera a atividade por conta própria.
 */
export function conclusion(report: Report): string {
  const counts = countByStatus(report);
  const total = report.findings.length;
  const norms = joinNames(report.norms.map((norm) => norm.norm));
  const summary =
    `Foram verificados ${plural(total, "requisito", "requisitos")} de ${norms || "normas aplicáveis"}: ` +
    `${plural(counts.pendente, "pendente", "pendentes")}, ` +
    `${counts.decisao_humana} sujeito(s) a decisão do profissional, ` +
    `${plural(counts.nao_informado, "não informado", "não informados")} e ` +
    `${plural(counts.atendido, "atendido", "atendidos")} com base nas informações prestadas.`;

  if (counts.pendente > 0) {
    return (
      `${summary} Diante das pendências identificadas, recomenda-se não iniciar a atividade até que as ações ` +
      "do plano de ação sejam executadas e as respectivas evidências registradas. Os itens não informados e os " +
      "que dependem de decisão do profissional devem ser resolvidos antes da liberação."
    );
  }
  if (counts.decisao_humana + counts.nao_informado > 0) {
    return (
      `${summary} Não foram identificadas pendências, mas a conferência não está concluída: há itens sem ` +
      "informação ou que dependem de julgamento técnico. A liberação da atividade cabe ao profissional responsável, " +
      "após o tratamento desses itens."
    );
  }
  return (
    `${summary} Não foram identificadas pendências nas informações prestadas. A confirmação em campo das ` +
    "evidências declaradas e a liberação da atividade cabem ao profissional responsável."
  );
}

export interface ActionRow {
  ref: string;
  status: Status;
  action: string;
}

/** Tudo que não está atendido, na ordem de prioridade, com a ação recomendada. */
export function actionPlan(report: Report): ActionRow[] {
  return STATUS_ORDER.filter((status) => status !== "atendido").flatMap((status) =>
    report.findings
      .filter((finding) => finding.status === status)
      .map((finding) => ({ ref: finding.ref, status, action: (finding.recommendation ?? "").trim() || DEFAULT_ACTION[status] })),
  );
}
