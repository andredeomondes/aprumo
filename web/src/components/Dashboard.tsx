import { useEffect, useState } from "react";
import { api } from "../api";
import { summarize, type MetricsSnapshot } from "../metrics";

interface Payload {
  ai: MetricsSnapshot;
  budget: { limit: number; used: number };
}

const REFRESH_MS = 10_000;
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-papel px-4 py-3">
      <dt className="text-sm text-aco">{label}</dt>
      <dd className="font-display text-2xl font-bold">{value}</dd>
      {hint && <p className="text-xs text-aco">{hint}</p>}
    </div>
  );
}

/** O sistema em operação: quem está respondendo, quanto a reserva entra e quanto demora. */
export function Dashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .metrics()
        .then((payload) => active && (setData(payload as Payload), setError(null)))
        .catch((e: Error) => active && setError(e.message));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (error) return <p role="alert" className="border-l-4 border-perigo bg-papel px-4 py-3">{error}</p>;
  if (!data) return <p className="text-aco">Carregando métricas…</p>;

  const summary = summarize(data.ai);
  const analyze = data.ai.latency_ms["POST /v1/analyze"];
  const evaluate = data.ai.latency_ms["POST /v1/evaluate"];
  const totalAnalyses = Object.values(summary.analyses).reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby="painel" className="space-y-5">
      <div>
        <h2 id="painel" className="font-display text-xl font-bold">Painel de operação</h2>
        <p className="text-sm text-aco">
          Desde o último início do serviço ({Math.round(data.ai.uptime_s / 60)} min). Atualiza a cada 10 s.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px border border-linha bg-linha sm:grid-cols-4">
        <Stat label="Análises" value={String(totalAnalyses)} hint={`${summary.analyses.ok ?? 0} com normas`} />
        <Stat label="Orçamento do dia" value={`${data.budget.used}/${data.budget.limit}`} />
        <Stat label="Acerto de cache" value={percent(summary.cacheHitRate)} />
        <Stat label="Reserva por regras" value={String(summary.fallbacks)} hint="vezes que nenhum modelo respondeu" />
        <Stat label="Análise p50 / p95" value={analyze ? `${(analyze.p50 / 1000).toFixed(1)} s` : "—"}
          hint={analyze ? `p95 ${(analyze.p95 / 1000).toFixed(1)} s` : undefined} />
        <Stat label="Avaliação p50 / p95" value={evaluate ? `${(evaluate.p50 / 1000).toFixed(1)} s` : "—"}
          hint={evaluate ? `p95 ${(evaluate.p95 / 1000).toFixed(1)} s` : undefined} />
        <Stat label="Busca híbrida" value={percent(summary.hybridShare)} hint="consultas com embeddings" />
        <Stat label="Fora do domínio" value={String(summary.analyses.fora_do_dominio ?? 0)} hint="recusadas" />
      </dl>

      <div>
        <h3 className="font-display font-semibold">Provedores de linguagem</h3>
        {summary.providers.length === 0 ? (
          <p className="text-sm text-aco">Nenhuma chamada desde o início do serviço.</p>
        ) : (
          <table className="mt-2 w-full border border-linha bg-papel text-sm">
            <thead>
              <tr className="border-b border-linha text-left text-aco">
                <th className="px-3 py-2 font-medium">Provedor</th>
                <th className="px-3 py-2 text-right font-medium">Respondeu</th>
                <th className="px-3 py-2 text-right font-medium">Limite de taxa</th>
                <th className="px-3 py-2 text-right font-medium">Erro</th>
                <th className="px-3 py-2 text-right font-medium">Em pausa</th>
              </tr>
            </thead>
            <tbody>
              {summary.providers.map((row) => (
                <tr key={row.provider} className="border-b border-linha last:border-0">
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2 text-right">{row.ok}</td>
                  <td className="px-3 py-2 text-right">{row.rate_limited}</td>
                  <td className="px-3 py-2 text-right">{row.error}</td>
                  <td className="px-3 py-2 text-right">{row.resting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {summary.topNorms.length > 0 && (
        <div>
          <h3 className="font-display font-semibold">Normas mais identificadas</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.topNorms.map(({ norm, count }) => (
              <li key={norm} className="flex items-center gap-3">
                <span className="w-14">{norm}</span>
                <span className="h-2 bg-grafite" style={{ width: `${(count / summary.topNorms[0].count) * 60}%` }} />
                <span className="text-aco">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
