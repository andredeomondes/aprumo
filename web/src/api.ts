import type { Analysis, Question, Turn, CreateFeedback, CreateHistoryRevision, Feedback, HistoryRecord, HistorySummary, QA, Report, Requirement } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";
/** Sem login: cada navegador tem um identificador próprio e só enxerga o próprio histórico. */
function clientId(): string {
  const key = "aprumo-client";
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return "";
  }
}

const CLIENT_HEADERS: Record<string, string> = clientId() ? { "x-aprumo-client": clientId() } : {};
const FALLBACK_ERROR = "Não consegui falar com o servidor. Confira a conexão e tente de novo.";

async function request(path: string, body: unknown): Promise<Response> {
  return mutate(path, body, "POST");
}

async function mutate(path: string, body: unknown, method: "POST" | "PATCH" | "DELETE"): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", ...CLIENT_HEADERS },
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

async function get(path: string): Promise<Response> {
  let response: Response;
  try {
    // Sem identificador (navegador sem armazenamento), a chamada sai sem opções.
    response = await (CLIENT_HEADERS["x-aprumo-client"] ? fetch(`${BASE}${path}`, { headers: CLIENT_HEADERS }) : fetch(`${BASE}${path}`));
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? FALLBACK_ERROR);
  }
  return response;
}

export interface AprumoGateway {
  warmUp(): void;
  analyze(activity: string): Promise<Analysis>;
  evaluate(activity: string, requirements: Requirement[], answers: QA[]): Promise<Report>;
  converse(activity: string, question: Question, requirements: Requirement[], answer: string, allowFollowUp: boolean): Promise<Turn>;
  metrics(): Promise<unknown>;
  reportPdf(report: Report): Promise<Blob>;
  history(archived?: boolean): Promise<HistorySummary[]>;
  historyEntry(id: string): Promise<HistoryRecord>;
  sendFeedback(id: string, feedback: CreateFeedback): Promise<Feedback>;
  reviseHistory(id: string, revision: CreateHistoryRevision): Promise<HistoryRecord>;
  archiveHistory(id: string, archived: boolean): Promise<HistoryRecord>;
  deleteHistory(id: string, confirmation: "EXCLUIR"): Promise<void>;
}

export const api: AprumoGateway = {
  /** Acorda BFF e serviço de IA do plano gratuito enquanto a pessoa ainda está digitando. */
  warmUp(): void {
    fetch(`${BASE}/api/metrics`).catch(() => undefined);
  },

  async analyze(activity: string): Promise<Analysis> {
    return (await request("/api/analyze", { activity })).json();
  },

  async evaluate(activity: string, requirements: Requirement[], answers: QA[]): Promise<Report> {
    return (await request("/api/evaluate", { activity, requirements, answers })).json();
  },

  async converse(activity, question, requirements, answer, allowFollowUp): Promise<Turn> {
    const body = { activity, question, requirements, answer, allow_follow_up: allowFollowUp };
    return (await request("/api/converse", body)).json();
  },

  async metrics(): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/api/metrics`);
    } catch {
      throw new Error(FALLBACK_ERROR);
    }
    if (!response.ok) throw new Error("Métricas indisponíveis no momento.");
    return response.json();
  },

  async reportPdf(report: Report): Promise<Blob> {
    return (await request("/api/report.pdf", report)).blob();
  },

  async history(archived = false): Promise<HistorySummary[]> {
    return (await get(`/api/history?archived=${archived}`)).json();
  },

  async historyEntry(id: string): Promise<HistoryRecord> {
    return (await get(`/api/history/${encodeURIComponent(id)}`)).json();
  },

  async sendFeedback(id: string, feedback: CreateFeedback): Promise<Feedback> {
    return (await request(`/api/history/${encodeURIComponent(id)}/feedback`, feedback)).json();
  },

  async reviseHistory(id: string, revision: CreateHistoryRevision): Promise<HistoryRecord> {
    return (await request(`/api/history/${encodeURIComponent(id)}/revisions`, revision)).json();
  },

  async archiveHistory(id: string, archived: boolean): Promise<HistoryRecord> {
    return (await mutate(`/api/history/${encodeURIComponent(id)}/archive`, { archived }, "PATCH")).json();
  },

  async deleteHistory(id: string, confirmation: "EXCLUIR"): Promise<void> {
    await mutate(`/api/history/${encodeURIComponent(id)}`, { confirmation }, "DELETE");
  },
};
