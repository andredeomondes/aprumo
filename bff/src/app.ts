import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AiServiceError, type AiClient } from "./ai-client.js";
import { AnalyzeBody, EvaluateBody, ReportSchema, type Report } from "./schemas.js";

export interface AppDeps {
  aiClient: AiClient;
  corsOrigin: string | string[];
  rateLimitMax: number;
  renderPdf: (report: Report) => Promise<Buffer>;
}

export async function buildApp({ aiClient, corsOrigin, rateLimitMax, renderPdf }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test" && !process.env.VITEST,
    bodyLimit: 256 * 1024,
    trustProxy: true,
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

  app.post("/api/analyze", async (request) => aiClient.analyze(AnalyzeBody.parse(request.body).activity));

  app.post("/api/evaluate", async (request) => aiClient.evaluate(EvaluateBody.parse(request.body)));

  app.post("/api/report.pdf", async (request, reply) => {
    const pdf = await renderPdf(ReportSchema.parse(request.body));
    return reply
      .type("application/pdf")
      .header("content-disposition", 'attachment; filename="aprumo-relatorio.pdf"')
      .send(pdf);
  });

  return app;
}
