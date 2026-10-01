import { describe, expect, it } from "vitest";
import type { AiClient } from "../src/ai-client.js";
import { buildApp } from "../src/app.js";
import type { Report } from "../src/schemas.js";

const requirement = { norm: "NR-35", item: "35.5.1", annex: null, text: "Proteção contra quedas.", revoked: false, ref: "NR-35 item 35.5.1" };
const report: Report = {
  activity: "Troca de luminária em poste a 7 metros",
  norms: [{ norm: "NR-35", title: "Trabalho em Altura", share: 1 }],
  findings: [{ ref: requirement.ref, status: "pendente", justification: "Sem linha de vida.", evidence: "", recommendation: "" }],
  requirements: [requirement],
  corpus_date: "2026-09-30",
  generated_at: "2026-10-01T12:00:00+00:00",
  disclaimer: "d",
  risk_context: [],
  answers: [],
};

const converseBody = {
  activity: "Troca de luminária em poste a 7 metros",
  question: { id: "q1", text: "Há proteção contra quedas?", refs: [requirement.ref], section: "controles" },
  requirements: [requirement],
  answer: "Não, a gente sobe de escada",
  allow_follow_up: true,
};

function app(overrides: Partial<AiClient> = {}, dailyBudget = 100) {
  const calls: unknown[] = [];
  const aiClient: AiClient = {
    analyze: async () => ({ status: "sem_base", message: "x", norms: [], requirements: [], questions: [], risk_context: [] }),
    evaluate: async () => report,
    metrics: async () => ({}),
    converse: async (body) => {
      calls.push(body);
      return { answered: true, reply: "Anotado: acesso por escada.", follow_up: "O que falta e quem resolve?" };
    },
    ...overrides,
  };
  return buildApp({ aiClient, corsOrigin: "*", rateLimitMax: 100, dailyBudget, renderPdf: async () => Buffer.from("%PDF") })
    .then((instance) => ({ instance, calls }));
}

describe("conversa", () => {
  it("encaminha o turno e devolve a fala do assistente", async () => {
    const { instance, calls } = await app();
    const res = await instance.inject({ method: "POST", url: "/api/converse", payload: converseBody });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ answered: true, reply: "Anotado: acesso por escada.", follow_up: "O que falta e quem resolve?" });
    expect(calls).toHaveLength(1);
  });

  it("rejeita turno sem resposta", async () => {
    const { instance } = await app();
    const res = await instance.inject({ method: "POST", url: "/api/converse", payload: { ...converseBody, answer: "" } });
    expect(res.statusCode).toBe(400);
  });

  it("conversar não consome o orçamento diário de análises", async () => {
    const { instance } = await app({}, 1);
    for (let i = 0; i < 3; i += 1) await instance.inject({ method: "POST", url: "/api/converse", payload: converseBody });
    const res = await instance.inject({ method: "POST", url: "/api/analyze", payload: { activity: converseBody.activity } });
    expect(res.statusCode).toBe(200);
  });
});

describe("histórico por navegador", () => {
  const alice = { "x-aprumo-client": "11111111-1111-4111-8111-111111111111" };
  const bob = { "x-aprumo-client": "22222222-2222-4222-8222-222222222222" };
  const evaluateBody = { activity: report.activity, requirements: [requirement], answers: [] };

  it("um navegador não enxerga nem abre os relatórios de outro", async () => {
    const { instance } = await app();
    const created = (await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluateBody, headers: alice })).json();

    expect((await instance.inject({ method: "GET", url: "/api/history", headers: alice })).json()).toHaveLength(1);
    expect((await instance.inject({ method: "GET", url: "/api/history", headers: bob })).json()).toEqual([]);
    expect((await instance.inject({ method: "GET", url: `/api/history/${created.history_id}`, headers: bob })).statusCode).toBe(404);
    expect((await instance.inject({ method: "GET", url: `/api/history/${created.history_id}`, headers: alice })).statusCode).toBe(200);
  });

  it("outro navegador não arquiva nem comenta o relatório alheio", async () => {
    const { instance } = await app();
    const created = (await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluateBody, headers: alice })).json();
    const archive = await instance.inject({ method: "PATCH", url: `/api/history/${created.history_id}/archive`, payload: { archived: true }, headers: bob });
    expect(archive.statusCode).toBe(404);
  });
});

describe("identificação do relatório", () => {
  it("aceita empresa, local e responsáveis para o PDF", async () => {
    let received: Report | undefined;
    const instance = await buildApp({
      aiClient: { analyze: async () => { throw new Error("x"); }, evaluate: async () => report, metrics: async () => ({}), converse: async () => ({ answered: true, reply: "", follow_up: null }) },
      corsOrigin: "*", rateLimitMax: 100, dailyBudget: 10,
      renderPdf: async (r) => { received = r; return Buffer.from("%PDF"); },
    });
    const identification = { company: "Metalúrgica Exemplo", location: "Galpão 2", responsible: "Maria Souza", reviewer: "" };
    const res = await instance.inject({ method: "POST", url: "/api/report.pdf", payload: { ...report, identification } });
    expect(res.statusCode).toBe(200);
    expect(received?.identification?.company).toBe("Metalúrgica Exemplo");
  });
});
