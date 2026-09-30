import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalysisSchema, ReportSchema } from "../src/schemas.js";

const contract = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "..", "contracts", name), "utf-8"));

describe("contrato com o serviço de IA", () => {
  it("aceita a análise que o Python produz", () => {
    expect(AnalysisSchema.parse(contract("analysis.json")).risk_context[0].sector).toBe("Construção");
    expect(AnalysisSchema.parse(contract("analysis-sem-base.json")).questions).toEqual([]);
  });

  it("aceita o relatório que o Python produz", () => {
    expect(ReportSchema.parse(contract("report.json")).findings[0].ref).toBe("NR-35 item 35.5.1");
  });
});
