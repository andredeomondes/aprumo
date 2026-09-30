import pytest

from aprumo_ai.accidents.trends import TrendService, backtest, holt_forecast, sector_series

DATA = {
    "months": {
        f"2025{m:02d}": {"4120": {"tipico": 100 + 10 * m, "trajeto": 5, "doenca": 1, "obitos": 1},
                         "8610": {"tipico": 50, "trajeto": 5, "doenca": 1, "obitos": 0}}
        for m in range(1, 13)
    }
    | {
        f"2026{m:02d}": {"4120": {"tipico": 220 + 10 * m, "trajeto": 5, "doenca": 1, "obitos": 2},
                         "8610": {"tipico": 50, "trajeto": 5, "doenca": 1, "obitos": 0}}
        for m in range(1, 13)
    }
}


def test_holt_segue_a_tendencia_linear():
    series = [float(10 + 2 * t) for t in range(24)]
    forecast = holt_forecast(series, horizon=3)
    assert forecast == pytest.approx([58.0, 60.0, 62.0], abs=1.5)


def test_backtest_compara_com_o_ingenuo():
    series = [float(10 + 2 * t) for t in range(24)]
    result = backtest(series, holdout=6)
    assert result["holt_mae"] < result["naive_mae"]


def test_serie_soma_os_prefixos_do_setor():
    months, values, deaths = sector_series(DATA, ["41"])
    assert months[0] == "202501" and values[0] == 110
    assert deaths[-1] == 2


def test_tendencia_por_norma_setorial():
    [trend] = TrendService(DATA).for_norms(["NR-18"])
    assert trend.norm == "NR-18" and "Construção" in trend.sector
    assert trend.last_12m > trend.previous_12m
    assert trend.change_pct > 0
    assert len(trend.forecast) == 3


def test_norma_transversal_nao_tem_setor():
    assert TrendService(DATA).for_norms(["NR-35", "NR-06"]) == []


def test_serie_curta_nao_gera_tendencia():
    short = {"months": dict(list(DATA["months"].items())[:6])}
    assert TrendService(short).for_norms(["NR-18"]) == []


def test_usa_so_a_janela_completa_da_serie():
    windowed = {**DATA, "complete_from": "202503", "complete_until": "202610"}
    months, values, _ = sector_series(windowed, ["41"])
    assert months[0] == "202503" and months[-1] == "202610"


def test_serie_com_buracos_de_publicacao_e_recusada():
    from aprumo_ai.accidents.trends import series_is_reliable

    steady = [100, 110, 95, 105, 98, 102] * 4
    assert series_is_reliable(steady)
    assert not series_is_reliable(steady[:10] + [5] + steady[11:]), "mês quase vazio"
    assert not series_is_reliable(steady[:10] + [400] + steady[11:]), "mês com acúmulo"


def test_setor_com_serie_ruim_nao_aparece():
    broken = {"months": {k: v for k, v in DATA["months"].items()}}
    broken["months"]["202506"] = {"4120": {"tipico": 3, "trajeto": 0, "doenca": 0, "obitos": 0}}
    assert TrendService(broken).for_norms(["NR-18"]) == []
