import { describe, expect, it } from "vitest";
import { AiServiceError, type AiClient } from "../src/ai-client.js";
import { buildApp } from "../src/app.js";
import type { Analysis, Report } from "../src/schemas.js";

const analysis: Analysis = { status: "sem_base", message: "x", norms: [], requirements: [], questions: [] };
const report: Report = {
  activity: "Troca de lâmpada em altura",
  norms: [],
  findings: [],
  requirements: [],
  corpus_date: "2026-09-30",
  generated_at: "2026-09-30T20:00:00+00:00",
  disclaimer: "d",
};

function fakeAi(overrides: Partial<AiClient> = {}): AiClient {
  return { analyze: async () => analysis, evaluate: async () => report, ...overrides };
}

function app(ai = fakeAi(), rateLimitMax = 100) {
  return buildApp({
    aiClient: ai,
    corsOrigin: "*",
    rateLimitMax,
    renderPdf: async () => Buffer.from("%PDF-1.7 fake"),
  });
}

const ACTIVITY = { activity: "trabalho em altura no telhado" };

describe("bff", () => {
  it("encaminha análise válida", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("sem_base");
  });

  it("rejeita corpo inválido com 400 e mensagem", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/api/analyze", payload: { activity: 42 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Dados inválidos.");
  });

  it("rejeita corpo gigante com 413", async () => {
    const res = await (await app()).inject({
      method: "POST",
      url: "/api/analyze",
      payload: { activity: "a".repeat(300 * 1024) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("traduz falha do serviço de IA na mensagem dele", async () => {
    const ai = fakeAi({ analyze: async () => { throw new AiServiceError(502, "fora do ar"); } });
    const res = await (await app(ai)).inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toBe("fora do ar");
  });

  it("limita a taxa por IP", async () => {
    const instance = await app(fakeAi(), 1);
    await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    const res = await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    expect(res.statusCode).toBe(429);
  });

  it("devolve PDF como anexo", async () => {
    const res = await (await app()).inject({ method: "POST", url: "/api/report.pdf", payload: report });
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("aprumo-relatorio.pdf");
    expect(res.body.startsWith("%PDF")).toBe(true);
  });

  it("health responde sem depender do serviço de IA", async () => {
    const res = await (await app()).inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ status: "ok" });
  });
});
