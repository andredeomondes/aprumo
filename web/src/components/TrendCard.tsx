import type { SectorTrend } from "../types";

const number = new Intl.NumberFormat("pt-BR");

function monthLabel(yyyymm: string): string {
  return `${yyyymm.slice(4, 6)}/${yyyymm.slice(2, 4)}`;
}

function Sparkline({ values, forecast }: { values: number[]; forecast: number[] }) {
  const all = [...values, ...forecast];
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const width = 260;
  const height = 44;
  const step = width / Math.max(all.length - 1, 1);
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height;
  const points = (list: number[], offset: number) => list.map((v, i) => `${(i + offset) * step},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Série mensal de acidentes no setor">
      <polyline points={points(values, 0)} fill="none" stroke="currentColor" strokeWidth="2" />
      {forecast.length > 0 && (
        <polyline
          points={points([values[values.length - 1], ...forecast], values.length - 1)}
          fill="none"
          stroke="var(--amber)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}

/** Acidentes típicos do setor (CAT/INSS). Só chega aqui a série que passou no filtro de qualidade. */
export function TrendCard({ trend }: { trend: SectorTrend }) {
  const rising = trend.change_pct >= 0;
  const forecast = trend.forecast_beats_naive ? trend.forecast : [];
  return (
    <article className="trend">
      <strong>
        {trend.sector} · {trend.norm}
      </strong>
      <p>
        {number.format(trend.last_12m)} acidentes típicos em 12 meses,{" "}
        <span className={rising ? "up" : "down"}>
          {rising ? "alta" : "queda"} de {Math.abs(trend.change_pct).toLocaleString("pt-BR")}%
        </span>
        ; {number.format(trend.deaths_12m)} com óbito.
      </p>
      <Sparkline values={trend.values} forecast={forecast} />
      <small>
        {monthLabel(trend.months[0])} a {monthLabel(trend.months[trend.months.length - 1])}
        {forecast.length > 0 ? " · tracejado: projeção de 3 meses" : ""}
      </small>
    </article>
  );
}
