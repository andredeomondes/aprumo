import { describe, expect, it } from "vitest";
import { APRUMO_LOGO } from "../src/pdf/logo.js";
import { renderReportPdf } from "../src/pdf/render-report.js";
import type { Report } from "../src/schemas.js";

const report: Report = {
  activity: "Manutenção elétrica em altura, técnico [CPF]",
  norms: [
    { norm: "NR-35", title: "Trabalho em Altura", share: 0 },
    { norm: "NR-10", title: "Segurança em Instalações e Serviços em Eletricidade", share: 0 },
  ],
  requirements: [
    { norm: "NR-35", item: "35.5.1", annex: null, text: "Proteção contra quedas.", revoked: false, ref: "NR-35 item 35.5.1" },
    { norm: "NR-10", item: "10.5.1", annex: null, text: "Desenergização.", revoked: false, ref: "NR-10 item 10.5.1" },
  ],
  findings: [
    { ref: "NR-35 item 35.5.1", status: "pendente", justification: "Não há linha de vida.", evidence: "O responsável informou que a instalação está pendente.", recommendation: "Instalar linha de vida e registrar a inspeção." },
    { ref: "NR-10 item 10.5.1", status: "atendido", justification: "Circuito desligado e bloqueado.", evidence: "", recommendation: "" },
  ],
  corpus_date: "2026-09-30",
  generated_at: "2026-09-30T20:00:00+00:00",
  disclaimer: "Não substitui profissional habilitado.",
  answers: [
    { question: "A atividade foi planejada e possui responsável definido?", answer: "Sim, conforme procedimento interno." },
    { question: "Há proteção contra quedas disponível e inspecionada?", answer: "Não; a instalação está pendente." },
  ],
  risk_context: [
    {
      norm: "NR-18", sector: "Construção", months: ["202506", "202507"], values: [900, 950],
      last_12m: 11000, previous_12m: 10000, change_pct: 10, deaths_12m: 40,
      forecast: [960, 970, 980], forecast_beats_naive: true,
    },
  ],
};

describe("renderReportPdf", () => {
  it("gera PDF válido", async () => {
    const pdf = await renderReportPdf(report);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(8000);
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("aguenta relatório longo sem quebrar", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ref: `NR-12 item 12.${i}`, status: "nao_informado" as const, justification: "Sem informação. ".repeat(10),
    }));
    const pdf = await renderReportPdf({ ...report, findings: many });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("inclui o contexto de acidentes do setor", async () => {
    const withContext = await renderReportPdf(report);
    const without = await renderReportPdf({ ...report, risk_context: [] });
    expect(withContext.length).toBeGreaterThan(without.length + 300);
  });


  it("incorpora a logo oficial como PNG", () => {
    expect(APRUMO_LOGO.subarray(1, 4).toString()).toBe("PNG");
    expect(APRUMO_LOGO.readUInt32BE(16)).toBeGreaterThanOrEqual(300);
    expect(APRUMO_LOGO.readUInt32BE(20)).toBeGreaterThanOrEqual(300);
  });
});
