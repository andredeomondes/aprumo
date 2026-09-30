import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import { ZodError } from "zod";
import { AiServiceError, type AiClient } from "./ai-client.js";
import { DailyBudget } from "./daily-budget.js";
import { AnalyzeBody, EvaluateBody, ReportSchema, type Report } from "./schemas.js";

export interface AppDeps {
  aiClient: AiClient;
  corsOrigin: string | string[];
  rateLimitMax: number;
  dailyBudget: number;
  renderPdf: (report: Report) => Promise<Buffer>;
}

export async function buildApp({ aiClient, corsOrigin, rateLimitMax, dailyBudget, renderPdf }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test" && !process.env.VITEST,
    bodyLimit: 256 * 1024,
    // Um salto: o proxy do Render. Confiar em todos deixaria forjar o IP pelo X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < 1,
  });
  await app.register(cors, { origin: corsOrigin });
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

  app.post("/api/evaluate", { preHandler: spendBudget }, async (request) =>
    aiClient.evaluate(EvaluateBody.parse(request.body)),
  );

  app.get("/api/metrics", async () => ({ ai: await aiClient.metrics(), budget: budget.usage() }));

  app.post("/api/report.pdf", async (request, reply) => {
    const pdf = await renderPdf(ReportSchema.parse(request.body));
    return reply
      .type("application/pdf")
      .header("content-disposition", 'attachment; filename="aprumo-relatorio.pdf"')
      .send(pdf);
  });

  return app;
}
