import type { SectorTrend } from "../types";

const number = new Intl.NumberFormat("pt-BR");

function monthLabel(yyyymm: string): string {
  return `${yyyymm.slice(4, 6)}/${yyyymm.slice(2, 4)}`;
}

/** Linha dos últimos meses; a projeção segue tracejada quando passou no backtest. */
function Sparkline({ values, forecast }: { values: number[]; forecast: number[] }) {
  const all = [...values, ...forecast];
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const width = 240;
  const height = 48;
  const step = width / Math.max(all.length - 1, 1);
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height;
  const points = (list: number[], offset: number) => list.map((v, i) => `${(i + offset) * step},${y(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-60" role="img" aria-label="Série mensal de acidentes">
      <polyline points={points(values, 0)} fill="none" stroke="currentColor" strokeWidth="2" />
      {forecast.length > 0 && (
        <polyline
          points={points([values[values.length - 1], ...forecast], values.length - 1)}
          fill="none"
          stroke="var(--color-atencao)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}

export function TrendCard({ trend }: { trend: SectorTrend }) {
  const rising = trend.change_pct >= 0;
  const forecast = trend.forecast_beats_naive ? trend.forecast : [];
  return (
    <div className="border-l-4 border-aco bg-papel px-4 py-3">
      <p className="font-display font-semibold">
        {trend.sector} <span className="font-sans text-sm font-normal text-aco">({trend.norm})</span>
      </p>
      <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="text-sm">
          <span className="font-display text-xl font-bold">{number.format(trend.last_12m)}</span> acidentes típicos
          em 12 meses,{" "}
          <span className={rising ? "text-perigo" : "text-seguro"}>
            {rising ? "alta" : "queda"} de {Math.abs(trend.change_pct).toLocaleString("pt-BR")}%
          </span>
          . {number.format(trend.deaths_12m)} com óbito.
        </p>
        <div className="text-grafite">
          <Sparkline values={trend.values} forecast={forecast} />
          <p className="text-xs text-aco">
            {monthLabel(trend.months[0])} a {monthLabel(trend.months[trend.months.length - 1])}
            {forecast.length > 0 ? " · tracejado: projeção de 3 meses" : " · sem projeção: não superou o ingênuo"}
          </p>
        </div>
      </div>
    </div>
  );
}
