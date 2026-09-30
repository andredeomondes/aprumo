import type { Analysis, QA, Report, Requirement } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";
const FALLBACK_ERROR = "Não consegui falar com o servidor. Confira a conexão e tente de novo.";

async function request(path: string, body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (response.status === 429) throw new Error("Muitas tentativas seguidas. Espere um minuto e tente de novo.");
    throw new Error(payload.message ?? FALLBACK_ERROR);
  }
  return response;
}

export const api = {
  /** Acorda BFF e serviço de IA do plano gratuito enquanto a pessoa ainda está digitando. */
  warmUp(): void {
    fetch(`${BASE}/health`).catch(() => undefined);
  },

  async analyze(activity: string): Promise<Analysis> {
    return (await request("/api/analyze", { activity })).json();
  },

  async evaluate(activity: string, requirements: Requirement[], answers: QA[]): Promise<Report> {
    return (await request("/api/evaluate", { activity, requirements, answers })).json();
  },

  async reportPdf(report: Report): Promise<Blob> {
    return (await request("/api/report.pdf", report)).blob();
  },
};
