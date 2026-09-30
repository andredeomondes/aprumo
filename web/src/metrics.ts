export interface MetricsSnapshot {
  uptime_s: number;
  counters: Record<string, number>;
  latency_ms: Record<string, { count: number; p50: number; p95: number }>;
}

export interface ProviderRow {
  provider: string;
  ok: number;
  rate_limited: number;
  error: number;
  resting: number;
}

export interface Summary {
  providers: ProviderRow[];
  cacheHitRate: number | null;
  fallbacks: number;
  analyses: Record<string, number>;
  topNorms: { norm: string; count: number }[];
  hybridShare: number | null;
}

interface Counter {
  name: string;
  labels: Record<string, string>;
  value: number;
}

/** "llm{outcome=ok,provider=groq}" → { name: "llm", labels: { outcome: "ok", provider: "groq" } } */
function parse(counters: Record<string, number>): Counter[] {
  return Object.entries(counters).map(([key, value]) => {
    const match = key.match(/^([^{]+)(?:\{(.*)\})?$/);
    const labels = Object.fromEntries(
      (match?.[2] ?? "").split(",").filter(Boolean).map((pair) => pair.split("=") as [string, string]),
    );
    return { name: match?.[1] ?? key, labels, value };
  });
}

const sum = (list: Counter[]) => list.reduce((total, c) => total + c.value, 0);

export function summarize(snapshot: MetricsSnapshot): Summary {
  const counters = parse(snapshot.counters);
  const of = (name: string) => counters.filter((c) => c.name === name);

  const providers = new Map<string, ProviderRow>();
  for (const c of of("llm")) {
    const row = providers.get(c.labels.provider) ?? { provider: c.labels.provider, ok: 0, rate_limited: 0, error: 0, resting: 0 };
    const outcome = c.labels.outcome as keyof Omit<ProviderRow, "provider">;
    if (outcome in row) row[outcome] += c.value;
    providers.set(row.provider, row);
  }

  const hits = sum(of("cache").filter((c) => c.labels.result === "hit"));
  const lookups = sum(of("cache"));
  const retrievals = sum(of("retrieval"));

  return {
    providers: [...providers.values()],
    cacheHitRate: lookups ? hits / lookups : null,
    fallbacks: sum(of("fallback_to_rules")),
    analyses: Object.fromEntries(of("analysis").map((c) => [c.labels.status, c.value])),
    topNorms: of("norm_identified")
      .map((c) => ({ norm: c.labels.norm, count: c.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    hybridShare: retrievals ? sum(of("retrieval").filter((c) => c.labels.mode === "hybrid")) / retrievals : null,
  };
}
