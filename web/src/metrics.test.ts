import { describe, expect, it } from "vitest";
import { summarize } from "./metrics";

const snapshot = {
  uptime_s: 120,
  counters: {
    "llm{outcome=ok,provider=groq:qwen}": 8,
    "llm{outcome=rate_limited,provider=groq:qwen}": 2,
    "llm{outcome=ok,provider=gemini}": 2,
    "cache{result=hit}": 3,
    "cache{result=miss}": 9,
    "fallback_to_rules{step=avaliação}": 1,
    "analysis{status=ok}": 4,
    "analysis{status=fora_do_dominio}": 1,
    "norm_identified{norm=NR-35}": 3,
    "norm_identified{norm=NR-10}": 2,
    "retrieval{mode=hybrid}": 5,
  },
  latency_ms: { "POST /v1/analyze": { count: 5, p50: 2100, p95: 4000 } },
};

describe("painel", () => {
  it("agrupa os resultados por provedor", () => {
    const summary = summarize(snapshot);
    expect(summary.providers).toEqual([
      { provider: "groq:qwen", ok: 8, rate_limited: 2, error: 0, resting: 0 },
      { provider: "gemini", ok: 2, rate_limited: 0, error: 0, resting: 0 },
    ]);
  });

  it("calcula acerto de cache, uso da reserva e normas mais frequentes", () => {
    const summary = summarize(snapshot);
    expect(summary.cacheHitRate).toBeCloseTo(0.25);
    expect(summary.fallbacks).toBe(1);
    expect(summary.analyses).toEqual({ ok: 4, fora_do_dominio: 1 });
    expect(summary.topNorms[0]).toEqual({ norm: "NR-35", count: 3 });
    expect(summary.hybridShare).toBe(1);
  });

  it("aguenta painel vazio", () => {
    const summary = summarize({ uptime_s: 0, counters: {}, latency_ms: {} });
    expect(summary.cacheHitRate).toBeNull();
    expect(summary.providers).toEqual([]);
  });
});
