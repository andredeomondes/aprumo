import { describe, expect, it } from "vitest";
import { AiServiceError, type AiClient } from "../src/ai-client.js";
import { buildApp } from "../src/app.js";
import { MemoryHistoryStore } from "../src/history-store.js";
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
  risk_context: [],
  answers: [],
};

function fakeAi(overrides: Partial<AiClient> = {}): AiClient {
  return {
    analyze: async () => analysis,
    evaluate: async () => report,
    metrics: async () => ({ counters: { "llm{outcome=ok,provider=groq}": 3 } }),
    ...overrides,
  };
}

function app(ai = fakeAi(), rateLimitMax = 100, dailyBudget = 1000) {
  return buildApp({
    aiClient: ai,
    corsOrigin: "*",
    rateLimitMax,
    dailyBudget,
    renderPdf: async () => Buffer.from("%PDF-1.7 fake"),
  });
}

const ACTIVITY = { activity: "trabalho em altura no telhado" };

const requirement = {
  norm: "NR-35",
  item: "35.4.1",
  annex: null,
  text: "Planejar o trabalho em altura.",
  revoked: false,
  ref: "NR-35 item 35.4.1",
};

const evaluation = {
  activity: ACTIVITY.activity,
  requirements: [requirement],
  answers: [{ question: "A atividade foi planejada?", answer: "Sim" }],
};

describe("bff", () => {
  it("libera no navegador os métodos usados para arquivar e excluir", async () => {
    const instance = await app();
    const patchPreflight = await instance.inject({
      method: "OPTIONS",
      url: "/api/history/00000000-0000-4000-8000-000000000000/archive",
      headers: { origin: "http://localhost:5173", "access-control-request-method": "PATCH" },
    });
    const deletePreflight = await instance.inject({
      method: "OPTIONS",
      url: "/api/history/00000000-0000-4000-8000-000000000000",
      headers: { origin: "http://localhost:5173", "access-control-request-method": "DELETE" },
    });

    expect(patchPreflight.statusCode).toBe(204);
    expect(patchPreflight.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(deletePreflight.statusCode).toBe(204);
    expect(deletePreflight.headers["access-control-allow-methods"]).toContain("DELETE");
  });

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

  it("leituras do painel e histórico não consomem o limite das operações", async () => {
    const instance = await app(fakeAi(), 1);
    for (let index = 0; index < 12; index += 1) {
      expect((await instance.inject({ method: "GET", url: "/api/metrics" })).statusCode).toBe(200);
      expect((await instance.inject({ method: "GET", url: "/api/history" })).statusCode).toBe(200);
    }

    expect((await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY })).statusCode).toBe(200);
    expect((await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY })).statusCode).toBe(429);
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

  it("não deixa forjar o IP pelo X-Forwarded-For para furar o limite", async () => {
    const instance = await app(fakeAi(), 1);
    const send = (spoofed: string) =>
      instance.inject({
        method: "POST",
        url: "/api/analyze",
        payload: ACTIVITY,
        headers: { "x-forwarded-for": `${spoofed}, 203.0.113.7` },
      });
    await send("1.1.1.1");
    expect((await send("2.2.2.2")).statusCode).toBe(429);
  });

  it("orçamento diário protege a cota dos modelos", async () => {
    const instance = await app(fakeAi(), 100, 2);
    const call = () => instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    await call();
    await call();
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(res.json().message).toContain("limite diário");
  });

  it("gerar PDF não consome o orçamento dos modelos", async () => {
    const instance = await app(fakeAi(), 100, 1);
    await instance.inject({ method: "POST", url: "/api/report.pdf", payload: report });
    const res = await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    expect(res.statusCode).toBe(200);
  });

  it("repassa as métricas do serviço de IA com o uso do orçamento", async () => {
    const instance = await app(fakeAi(), 100, 5);
    await instance.inject({ method: "POST", url: "/api/analyze", payload: ACTIVITY });
    const body = (await instance.inject({ method: "GET", url: "/api/metrics" })).json();
    expect(body.ai.counters["llm{outcome=ok,provider=groq}"]).toBe(3);
    expect(body.budget).toEqual({ limit: 5, used: 1 });
  });

  it("salva automaticamente o relatório concluído e cria versões da mesma atividade", async () => {
    const historyStore = new MemoryHistoryStore();
    const instance = await buildApp({
      aiClient: fakeAi(), corsOrigin: "*", rateLimitMax: 100, dailyBudget: 10,
      renderPdf: async () => Buffer.from("%PDF"), historyStore,
    });

    const first = await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluation });
    await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluation });
    expect(first.statusCode).toBe(200);
    expect(first.json().history_id).toMatch(/[0-9a-f-]{36}/);

    const history = (await instance.inject({ method: "GET", url: "/api/history" })).json();
    expect(history).toHaveLength(2);
    expect(history.map((item: { version: number }) => item.version).sort()).toEqual([1, 2]);
  });

  it("registra feedback técnico sem alterar o relatório original", async () => {
    const instance = await app();
    const evaluated = await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluation });
    const id = evaluated.json().history_id as string;
    const feedback = await instance.inject({
      method: "POST",
      url: `/api/history/${id}/feedback`,
      payload: {
        target_type: "requisito",
        target_ref: "NR-35 item 35.4.1",
        verdict: "incompleto",
        comment: "Faltou citar a análise de risco.",
        correction: "Incluir a evidência da AR.",
      },
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json()).toMatchObject({ reviewed: false, verdict: "incompleto" });

    const record = (await instance.inject({ method: "GET", url: `/api/history/${id}` })).json();
    expect(record.feedback).toHaveLength(1);
    expect(record.report.findings).toEqual(report.findings);
  });

  it("responde 404 para histórico inexistente", async () => {
    const res = await (await app()).inject({
      method: "GET",
      url: "/api/history/00000000-0000-4000-8000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });

  it("versiona, arquiva, restaura e só exclui definitivamente quando arquivado", async () => {
    const reportWithFinding: Report = {
      ...report,
      requirements: [requirement],
      findings: [{ ref: requirement.ref, status: "pendente", justification: "Sem evidência." }],
      answers: [{ question: "Há evidência?", answer: "Não" }],
    };
    const instance = await app(fakeAi({ evaluate: async () => reportWithFinding }));
    const created = await instance.inject({ method: "POST", url: "/api/evaluate", payload: evaluation });
    const id = created.json().history_id as string;

    const revision = await instance.inject({
      method: "POST",
      url: `/api/history/${id}/revisions`,
      payload: {
        activity: "Trabalho em altura revisado em campo",
        change_note: "Evidência documental conferida",
        answers: [{ question: "Há evidência?", answer: "Sim" }],
        findings: [{ ref: requirement.ref, status: "atendido", justification: "Documento conferido." }],
      },
    });
    expect(revision.statusCode).toBe(200);
    expect(revision.json()).toMatchObject({ version: 2, revision_of: id, change_note: "Evidência documental conferida" });

    const blocked = await instance.inject({ method: "DELETE", url: `/api/history/${id}`, payload: { confirmation: "EXCLUIR" } });
    expect(blocked.statusCode).toBe(409);

    expect((await instance.inject({ method: "PATCH", url: `/api/history/${id}/archive`, payload: { archived: true } })).statusCode).toBe(200);
    expect((await instance.inject({ method: "GET", url: "/api/history?archived=true" })).json()).toHaveLength(1);
    expect((await instance.inject({ method: "GET", url: "/api/history" })).json()).toHaveLength(1);

    expect((await instance.inject({ method: "PATCH", url: `/api/history/${id}/archive`, payload: { archived: false } })).json().archived_at).toBeNull();
    await instance.inject({ method: "PATCH", url: `/api/history/${id}/archive`, payload: { archived: true } });
    expect((await instance.inject({ method: "DELETE", url: `/api/history/${id}`, payload: { confirmation: "EXCLUIR" } })).statusCode).toBe(204);
    expect((await instance.inject({ method: "GET", url: `/api/history/${id}` })).statusCode).toBe(404);
  });
});
