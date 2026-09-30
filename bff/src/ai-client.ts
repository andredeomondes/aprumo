import type { z } from "zod";
import { AnalysisSchema, ReportSchema, type Analysis, type EvaluateBody, type Report } from "./schemas.js";

export class AiServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface AiClient {
  analyze(activity: string): Promise<Analysis>;
  evaluate(body: EvaluateBody): Promise<Report>;
  metrics(): Promise<unknown>;
}

/** Cliente do serviço de IA. 90 s cobrem o cold start do plano gratuito mais a chamada ao modelo. */
export class HttpAiClient implements AiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs = 90_000,
  ) {}

  analyze(activity: string): Promise<Analysis> {
    return this.post("/v1/analyze", { activity }, AnalysisSchema);
  }

  evaluate(body: EvaluateBody): Promise<Report> {
    return this.post("/v1/evaluate", body, ReportSchema);
  }

  async metrics(): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/metrics`, {
        headers: { "x-internal-token": this.token },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AiServiceError(504, "O serviço de análise demorou a responder.");
    }
    if (!res.ok) throw new AiServiceError(502, "Métricas indisponíveis.");
    return res.json();
  }

  private async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-token": this.token },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AiServiceError(504, "O serviço de análise demorou a responder. Tente de novo.");
    }
    const payload = (await res.json().catch(() => ({}))) as { detail?: unknown };
    if (!res.ok) {
      const message = typeof payload.detail === "string" ? payload.detail : "Falha no serviço de análise.";
      throw new AiServiceError(res.status >= 500 ? 502 : res.status, message);
    }
    return schema.parse(payload);
  }
}
