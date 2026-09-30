import { useEffect, useState } from "react";
import { api } from "../api";
import { summarize, type MetricsSnapshot } from "../metrics";

interface Payload {
  ai: MetricsSnapshot;
  budget: { limit: number; used: number };
}

const REFRESH_MS = 10_000;
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const seconds = (ms?: number) => (ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** O sistema em operação: quem está respondendo, quanto a reserva entra e quanto demora. */
export function Dashboard({ onError }: { onError: (message: string) => void }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .metrics()
        .then((payload) => active && setData(payload as Payload))
        .catch((error: Error) => active && onError(error.message));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onError]);

  const summary = data ? summarize(data.ai) : null;
  const analyze = data?.ai.latency_ms["POST /v1/analyze"];
  const evaluate = data?.ai.latency_ms["POST /v1/evaluate"];
  const total = summary ? Object.values(summary.analyses).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="page">
      <div className="page-inner">
        <h1>Painel de operação</h1>
        <p className="page-lede">
          {data
            ? `Desde o último início do serviço, há ${Math.round(data.ai.uptime_s / 60)} min. Atualiza a cada 10 s.`
            : "Carregando métricas…"}
        </p>
        {summary && data && (
          <>
            <dl className="metrics-grid">
              <Metric label="Análises" value={String(total)} hint={`${summary.analyses.ok ?? 0} com normas identificadas`} />
              <Metric label="Orçamento do dia" value={`${data.budget.used}/${data.budget.limit}`} />
              <Metric label="Acerto de cache" value={percent(summary.cacheHitRate)} />
              <Metric label="Reserva por regras" value={String(summary.fallbacks)} hint="nenhum modelo respondeu" />
              <Metric label="Análise p50" value={seconds(analyze?.p50)} hint={`p95 ${seconds(analyze?.p95)}`} />
              <Metric label="Avaliação p50" value={seconds(evaluate?.p50)} hint={`p95 ${seconds(evaluate?.p95)}`} />
              <Metric label="Busca híbrida" value={percent(summary.hybridShare)} hint="consultas com embeddings" />
              <Metric label="Fora do domínio" value={String(summary.analyses.fora_do_dominio ?? 0)} hint="recusadas" />
            </dl>

            <h2 className="subhead">Provedores de linguagem</h2>
            {summary.providers.length === 0 ? (
              <p className="muted-note">Nenhuma chamada desde o início do serviço.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th className="num">Respondeu</th>
                    <th className="num">Limite de taxa</th>
                    <th className="num">Erro</th>
                    <th className="num">Em pausa</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.providers.map((row) => (
                    <tr key={row.provider}>
                      <td>{row.provider}</td>
                      <td className="num">{row.ok}</td>
                      <td className="num">{row.rate_limited}</td>
                      <td className="num">{row.error}</td>
                      <td className="num">{row.resting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {summary.topNorms.length > 0 && (
              <>
                <h2 className="subhead">Normas mais identificadas</h2>
                <ul className="bars">
                  {summary.topNorms.map(({ norm, count }) => (
                    <li key={norm}>
                      <span>{norm}</span>
                      <i style={{ width: `${(count / summary.topNorms[0].count) * 100}%` }} />
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
