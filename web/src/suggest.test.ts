import { describe, expect, it } from "vitest";
import { applySuggestion, suggest, type SuggestionData } from "./suggest";

const data: SuggestionData = {
  activities: [
    "Troca de luminária em poste a 7 metros",
    "Limpeza interna de tanque de combustível",
    "Operação de empilhadeira no armazém",
  ],
  terms: ["permissão de trabalho", "trabalho em altura", "análise de risco", "espaço confinado"],
};

describe("autocompletar", () => {
  it("sugere atividade pelas palavras digitadas, sem depender de acento", () => {
    const result = suggest("limpeza tanque", data, true);
    expect(result[0]).toMatchObject({ kind: "activity", label: "Limpeza interna de tanque de combustível" });
  });

  it("completa o termo técnico que está sendo digitado", () => {
    const result = suggest("preciso de permissao de tra", data, true);
    const term = result.find((s) => s.kind === "term");
    expect(term?.label).toBe("permissão de trabalho");
    expect(applySuggestion("preciso de permissao de tra", term!)).toBe("preciso de permissão de trabalho ");
  });

  it("aplicar atividade troca o texto inteiro", () => {
    const [activity] = suggest("empilha", data, true);
    expect(applySuggestion("empilha", activity)).toBe("Operação de empilhadeira no armazém");
  });

  it("nas respostas não sugere atividade, só termo", () => {
    expect(suggest("espa", data, false).every((s) => s.kind === "term")).toBe(true);
  });

  it("não sugere com menos de dois caracteres nem o que já está escrito", () => {
    expect(suggest("a", data, true)).toEqual([]);
    expect(suggest("trabalho em altura", data, false).map((s) => s.label)).not.toContain("trabalho em altura");
  });

  it("limita a quantidade de sugestões", () => {
    const many: SuggestionData = { activities: [], terms: Array.from({ length: 20 }, (_, i) => `termo ${i}`) };
    expect(suggest("ter", many, false).length).toBeLessThanOrEqual(6);
  });
});
