import { describe, expect, it } from "vitest";
import { countByStatus, relevance, STATUS_ORDER } from "./status";

describe("status e relevância", () => {
  it("relevância sai da participação da norma na busca", () => {
    expect(relevance(0.62)).toBe("Alta");
    expect(relevance(0.3)).toBe("Média");
    expect(relevance(0.1)).toBe("Baixa");
  });

  it("conta todos os status, inclusive os que não aparecem", () => {
    const counts = countByStatus([
      { ref: "a", status: "pendente", justification: "" },
      { ref: "b", status: "pendente", justification: "" },
      { ref: "c", status: "atendido", justification: "" },
    ]);
    expect(counts).toEqual({ atendido: 1, pendente: 2, nao_informado: 0, decisao_humana: 0 });
  });

  it("ordem de exibição segue o vocabulário do produto", () => {
    expect(STATUS_ORDER).toEqual(["atendido", "pendente", "nao_informado", "decisao_humana"]);
  });
});
