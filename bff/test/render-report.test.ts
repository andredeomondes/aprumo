import { describe, expect, it } from "vitest";
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
    { ref: "NR-35 item 35.5.1", status: "pendente", justification: "Não há linha de vida." },
    { ref: "NR-10 item 10.5.1", status: "atendido", justification: "Circuito desligado e bloqueado." },
  ],
  corpus_date: "2026-09-30",
  generated_at: "2026-09-30T20:00:00+00:00",
  disclaimer: "Não substitui profissional habilitado.",
};

describe("renderReportPdf", () => {
  it("gera PDF válido", async () => {
    const pdf = await renderReportPdf(report);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it("aguenta relatório longo sem quebrar", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ref: `NR-12 item 12.${i}`, status: "nao_informado" as const, justification: "Sem informação. ".repeat(10),
    }));
    const pdf = await renderReportPdf({ ...report, findings: many });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
