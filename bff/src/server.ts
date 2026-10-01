import { HttpAiClient } from "./ai-client.js";
import { buildApp } from "./app.js";
import { JsonHistoryStore, MemoryHistoryStore } from "./history-store.js";
import { renderReportPdf } from "./pdf/render-report.js";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const historyFile = env("HISTORY_DATA_FILE", "data/history.json");
const app = await buildApp({
  aiClient: new HttpAiClient(env("AI_BASE_URL"), env("AI_INTERNAL_TOKEN")),
  corsOrigin: env("CORS_ORIGIN", "*").split(",").map((origin) => origin.trim()),
  rateLimitMax: Number(env("RATE_LIMIT_PER_MINUTE", "10")),
  dailyBudget: Number(env("DAILY_ANALYSIS_BUDGET", "300")),
  renderPdf: renderReportPdf,
  historyStore: historyFile === ":memory:" ? new MemoryHistoryStore() : await JsonHistoryStore.open(historyFile),
});

await app.listen({ host: "0.0.0.0", port: Number(env("PORT", "3000")) });
