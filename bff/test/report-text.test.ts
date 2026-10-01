import { describe, expect, it } from "vitest";
import { actionPlan, conclusion, reportNumber } from "../src/pdf/report-text.js";
import type { Report } from "../src/schemas.js";

const base: Report = {
  activity: "Troca de luminária em poste a 7 metros",
  norms: [
    { norm: "NR-35", title: "Trabalho em Altura", share: 0.6 },
    { norm: "NR-10", title: "Segurança em Instalações e Serviços em Eletricidade", share: 0.4 },
  ],
  requirements: [],
  findings: [
    { ref: "NR-35 item 35.5.1", status: "pendente", justification: "j", evidence: "e", recommendation: "Instalar linha de vida." },
    { ref: "NR-10 item 10.5.1", status: "atendido", justification: "j", evidence: "e", recommendation: "Manter registro." },
    { ref: "NR-35 item 35.3.2", status: "nao_informado", justification: "j", evidence: "", recommendation: "" },
    { ref: "NR-35 item 35.4.1", status: "decisao_humana", justification: "j", evidence: "e", recommendation: "Validar ancoragem." },
  ],
  corpus_date: "2026-09-30",
  generated_at: "2026-10-01T13:05:00+00:00",
  disclaimer: "d",
  risk_context: [],
  answers: [],
  history_id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
};

describe("texto do relatório", () => {
  it("número do relatório combina data de emissão e identificador", () => {
    expect(reportNumber(base)).toBe("AP-20261001-1B9D6BCD");
    expect(reportNumber({ ...base, history_id: undefined })).toMatch(/^AP-20261001-[0-9A-F]{8}$/);
  });

  it("conclusão com pendência recomenda não iniciar e traz as contagens", () => {
    const text = conclusion(base);
    expect(text).toContain("4 requisitos");
    expect(text).toContain("1 pendente");
    expect(text).toContain("não iniciar a atividade");
    expect(text).toContain("NR-35 e NR-10");
  });

  it("conclusão sem pendência não libera a atividade por conta própria", () => {
    const allMet = { ...base, findings: base.findings.map((f) => ({ ...f, status: "atendido" as const })) };
    const text = conclusion(allMet);
    expect(text).not.toContain("não iniciar a atividade");
    expect(text).toContain("profissional responsável");
  });

  it("plano de ação lista o que não está atendido, pendências primeiro, com ação padrão quando falta", () => {
    const plan = actionPlan(base);
    expect(plan.map((row) => row.ref)).toEqual(["NR-35 item 35.5.1", "NR-35 item 35.4.1", "NR-35 item 35.3.2"]);
    expect(plan[0].action).toBe("Instalar linha de vida.");
    expect(plan[2].action.length).toBeGreaterThan(10);
  });
});
