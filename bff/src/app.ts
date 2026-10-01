import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AiServiceError, type AiClient } from "./ai-client.js";
import { DailyBudget } from "./daily-budget.js";
import { MemoryHistoryStore, type HistoryStore } from "./history-store.js";
import { AnalyzeBody, ArchiveHistoryBody, ConverseBody, CreateFeedbackBody, CreateRevisionBody, DeleteHistoryBody, EvaluateBody, ReportSchema, type Report } from "./schemas.js";

export interface AppDeps {
  aiClient: AiClient;
  corsOrigin: string | string[];
  rateLimitMax: number;
  dailyBudget: number;
  renderPdf: (report: Report) => Promise<Buffer>;
  historyStore?: HistoryStore;
}

export async function buildApp({ aiClient, corsOrigin, rateLimitMax, dailyBudget, renderPdf, historyStore = new MemoryHistoryStore() }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test" && !process.env.VITEST,
    bodyLimit: 256 * 1024,
    // Um salto: o proxy do Render. Confiar em todos deixaria forjar o IP pelo X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < 1,
  });
  await app.register(cors, {
    origin: corsOrigin,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: rateLimitMax, timeWindow: "1 minute" });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ message: "Dados inválidos.", issues: error.issues });
    }
    if (error instanceof AiServiceError) {
      return reply.status(error.status).send({ message: error.message });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ message: "Erro inesperado." });
  });

  app.get("/health", { config: { rateLimit: false } }, async () => ({ status: "ok" }));

  const budget = new DailyBudget(dailyBudget);
  const spendBudget = async (_request: unknown, reply: FastifyReply) => {
    if (!budget.tryConsume()) {
      return reply.status(503).send({
        message: "O Aprumo atingiu o limite diário de análises da versão de demonstração. Tente amanhã.",
      });
    }
  };

  app.post("/api/analyze", { preHandler: spendBudget }, async (request) =>
    aiClient.analyze(AnalyzeBody.parse(request.body).activity),
  );

  // Um turno de conversa por resposta. Não entra no orçamento de análises (é uma chamada curta),
  // mas continua sob o limite por IP.
  app.post("/api/converse", async (request) => aiClient.converse(ConverseBody.parse(request.body)));

  // O histórico não tem login: cada navegador manda um identificador próprio e só enxerga o que
  // criou. Sem isso, qualquer visitante leria os relatórios de todos os outros.
  const owners = new Map<string, string>();
  const ownerOf = (request: FastifyRequest): string => {
    const header = request.headers["x-aprumo-client"];
    return typeof header === "string" && /^[0-9a-f-]{36}$/i.test(header) ? header : `ip:${request.ip}`;
  };
  const owns = (request: FastifyRequest, id: string): boolean => owners.get(id) === ownerOf(request);
  const NOT_FOUND = { message: "Conferência não encontrada no histórico." };

  app.post("/api/evaluate", { preHandler: spendBudget }, async (request) => {
    const report = await aiClient.evaluate(EvaluateBody.parse(request.body));
    const history = await historyStore.create(report);
    owners.set(history.id, ownerOf(request));
    return { ...report, history_id: history.id };
  });

  app.get<{ Querystring: { archived?: string } }>("/api/history", { config: { rateLimit: false } }, async (request) =>
    (await historyStore.list(request.query.archived === "true")).filter((item) => owns(request, item.id)),
  );

  app.get<{ Params: { id: string } }>("/api/history/:id", { config: { rateLimit: false } }, async (request, reply) => {
    const record = owns(request, request.params.id) ? await historyStore.get(request.params.id) : undefined;
    return record ?? reply.status(404).send(NOT_FOUND);
  });

  app.post<{ Params: { id: string } }>("/api/history/:id/feedback", async (request, reply) => {
    if (!owns(request, request.params.id)) return reply.status(404).send(NOT_FOUND);
    const feedback = await historyStore.addFeedback(request.params.id, CreateFeedbackBody.parse(request.body));
    return feedback ?? reply.status(404).send({ message: "Conferência não encontrada no histórico." });
  });

  app.post<{ Params: { id: string } }>("/api/history/:id/revisions", async (request, reply) => {
    const source = owns(request, request.params.id) ? await historyStore.get(request.params.id) : undefined;
    if (!source) return reply.status(404).send({ message: "Conferência não encontrada no histórico." });
    const revision = CreateRevisionBody.parse(request.body);
    const originalRefs = new Set(source.report.findings.map((finding) => finding.ref));
    if (revision.findings.length !== originalRefs.size || revision.findings.some((finding) => !originalRefs.has(finding.ref))) {
      return reply.status(400).send({ message: "A revisão deve manter os mesmos requisitos normativos." });
    }
    const report: Report = {
      ...source.report,
      activity: revision.activity,
      findings: revision.findings,
      answers: revision.answers,
      generated_at: new Date().toISOString(),
      history_id: undefined,
    };
    const revised = await historyStore.revise(source.id, report, revision.change_note);
    if (revised) owners.set(revised.id, ownerOf(request));
    return revised;
  });

  app.patch<{ Params: { id: string } }>("/api/history/:id/archive", async (request, reply) => {
    const { archived } = ArchiveHistoryBody.parse(request.body);
    if (!owns(request, request.params.id)) return reply.status(404).send(NOT_FOUND);
    const record = await historyStore.setArchived(request.params.id, archived);
    return record ?? reply.status(404).send({ message: "Conferência não encontrada no histórico." });
  });

  app.delete<{ Params: { id: string } }>("/api/history/:id", async (request, reply) => {
    DeleteHistoryBody.parse(request.body);
    if (!owns(request, request.params.id)) return reply.status(404).send(NOT_FOUND);
    const result = await historyStore.deleteArchived(request.params.id);
    if (result === "not_found") return reply.status(404).send({ message: "Conferência não encontrada no histórico." });
    if (result === "not_archived") return reply.status(409).send({ message: "Arquive a conferência antes de excluí-la definitivamente." });
    return reply.status(204).send();
  });

  // O painel consulta a cada 10 s e pode estar aberto em várias abas. Métricas
  // não consomem IA e não devem esgotar a cota das operações do usuário.
  app.get("/api/metrics", { config: { rateLimit: false } }, async () => ({ ai: await aiClient.metrics(), budget: budget.usage() }));

  app.post("/api/report.pdf", async (request, reply) => {
    const pdf = await renderPdf(ReportSchema.parse(request.body));
    return reply
      .type("application/pdf")
      .header("content-disposition", 'attachment; filename="aprumo-relatorio.pdf"')
      .send(pdf);
  });

  return app;
}
