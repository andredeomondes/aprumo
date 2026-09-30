"""Contexto de risco por setor: série mensal de acidentes típicos (CAT/INSS) e projeção.

Holt (suavização exponencial com tendência) em vez de um modelo sazonal: são ~38 meses,
pouco mais de três ciclos anuais, e a sazonalidade estimada com tão pouco dado mais
atrapalha do que ajuda. O backtest contra o ingênuo decide se a projeção é mostrada.
"""

import json
from itertools import product
from pathlib import Path

from pydantic import BaseModel

# Normas setoriais → setor econômico (prefixos de CNAE 2.0). Normas transversais, como
# NR-35 ou NR-06, não têm setor próprio e ficam sem série.
NORM_SECTORS: dict[str, tuple[str, list[str]]] = {
    "NR-18": ("Construção", ["41", "42", "43"]),
    "NR-22": ("Extração mineral", ["05", "07", "08", "09"]),
    "NR-31": ("Agricultura, pecuária e produção florestal", ["01", "02", "03"]),
    "NR-32": ("Atividades de atenção à saúde humana", ["86"]),
    "NR-36": ("Abate e fabricação de produtos de carne", ["101"]),
    "NR-29": ("Operações portuárias", ["5231", "5232"]),
    "NR-30": ("Transporte aquaviário", ["50"]),
    "NR-34": ("Construção e reparação naval", ["3011", "3012", "3317"]),
    "NR-37": ("Extração de petróleo e gás", ["06"]),
    "NR-38": ("Coleta e tratamento de resíduos", ["38"]),
    "NR-20": ("Combustíveis: refino e comércio", ["19", "4731", "4681"]),
    "NR-10": ("Eletricidade e gás", ["35"]),
    "NR-12": ("Indústria de transformação", [f"{d:02d}" for d in range(10, 34)]),
    "NR-19": ("Fabricação de explosivos", ["2092"]),
}
MIN_MONTHS = 18


class SectorTrend(BaseModel):
    norm: str
    sector: str
    months: list[str]
    values: list[int]
    last_12m: int
    previous_12m: int
    change_pct: float
    deaths_12m: int
    forecast: list[int]
    forecast_beats_naive: bool


def sector_series(data: dict, prefixes: list[str]) -> tuple[list[str], list[int], list[int]]:
    """Só os meses com notificação completa: antes do primeiro arquivo e nos últimos meses
    as CATs ainda estão chegando, e a série pareceria cair sem ter caído."""
    first = data.get("complete_from", "000000")
    last = data.get("complete_until", "999999")
    months = [m for m in sorted(data["months"]) if first <= m <= last]
    values, deaths = [], []
    for month in months:
        rows = [counts for cnae, counts in data["months"][month].items() if cnae.startswith(tuple(prefixes))]
        values.append(sum(r["tipico"] for r in rows))
        deaths.append(sum(r["obitos"] for r in rows))
    return months, values, deaths


def series_is_reliable(values: list[int], low: float = 0.4, high: float = 2.0) -> bool:
    """Recusa série com mês quase vazio ou com acúmulo: sinal de falha de publicação, não de
    mudança real. As CATs abertas do INSS de 2023 a 2026 reprovam aqui (meses com 5 CATs ao
    lado de meses com 100 mil), e por isso o Aprumo não mostra série nenhuma com elas."""
    ordered = sorted(values)
    median = ordered[len(ordered) // 2]
    return median > 0 and all(low * median <= v <= high * median for v in values)


def _holt(series: list[float], alpha: float, beta: float) -> tuple[float, float, float]:
    """Devolve nível, tendência e soma dos erros quadráticos de um passo à frente."""
    level, trend = series[0], series[1] - series[0]
    sse = 0.0
    for value in series[1:]:
        predicted = level + trend
        sse += (value - predicted) ** 2
        previous = level
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - previous) + (1 - beta) * trend
    return level, trend, sse


def holt_forecast(series: list[float], horizon: int) -> list[float]:
    grid = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]
    alpha, beta = min(product(grid, grid), key=lambda ab: _holt(series, *ab)[2])
    level, trend, _ = _holt(series, alpha, beta)
    return [level + (h + 1) * trend for h in range(horizon)]


def backtest(series: list[float], holdout: int = 6) -> dict[str, float]:
    """Previsão de um passo à frente nos últimos `holdout` meses: Holt contra o ingênuo."""
    holt_errors, naive_errors = [], []
    for cut in range(len(series) - holdout, len(series)):
        history = series[:cut]
        holt_errors.append(abs(series[cut] - holt_forecast(history, 1)[0]))
        naive_errors.append(abs(series[cut] - history[-1]))
    return {"holt_mae": sum(holt_errors) / holdout, "naive_mae": sum(naive_errors) / holdout}


class TrendService:
    def __init__(self, data: dict) -> None:
        self._data = data

    @classmethod
    def from_file(cls, path: Path) -> "TrendService | None":
        return cls(json.loads(path.read_text(encoding="utf-8"))) if path.exists() else None

    def for_norms(self, norms: list[str]) -> list[SectorTrend]:
        trends = []
        for norm in norms:
            if norm not in NORM_SECTORS:
                continue
            sector, prefixes = NORM_SECTORS[norm]
            months, values, deaths = sector_series(self._data, prefixes)
            if len(values) < MIN_MONTHS or sum(values[-12:]) == 0 or not series_is_reliable(values):
                continue
            last, previous = sum(values[-12:]), sum(values[-24:-12])
            series = [float(v) for v in values]
            quality = backtest(series)
            trends.append(SectorTrend(
                norm=norm,
                sector=sector,
                months=months[-24:],
                values=values[-24:],
                last_12m=last,
                previous_12m=previous,
                change_pct=round(100 * (last - previous) / previous, 1) if previous else 0.0,
                deaths_12m=sum(deaths[-12:]),
                forecast=[max(0, round(v)) for v in holt_forecast(series, 3)],
                forecast_beats_naive=quality["holt_mae"] < quality["naive_mae"],
            ))
        return trends
