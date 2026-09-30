"""Métricas em memória: contadores rotulados e latências recentes por rota.

Sem Prometheus nem banco: o serviço roda numa instância só, e o objetivo é enxergar,
durante a demonstração, qual provedor está respondendo, quanto a reserva é usada e se a
latência está dentro do esperado. Reiniciar o processo zera tudo, e isso é aceito.
"""

import threading
import time
from collections import Counter, deque


def _key(name: str, labels: dict[str, str]) -> str:
    if not labels:
        return name
    inner = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
    return f"{name}{{{inner}}}"


def _percentile(sorted_values: list[float], fraction: float) -> float:
    index = min(len(sorted_values) - 1, max(0, round(fraction * len(sorted_values)) - 1))
    return sorted_values[index]


class Metrics:
    def __init__(self, window: int = 500) -> None:
        self._lock = threading.Lock()
        self._counters: Counter[str] = Counter()
        self._latencies: dict[str, deque[float]] = {}
        self._window = window
        self._started = time.time()

    def inc(self, name: str, **labels: str) -> None:
        with self._lock:
            self._counters[_key(name, labels)] += 1

    def observe(self, route: str, seconds: float) -> None:
        with self._lock:
            self._latencies.setdefault(route, deque(maxlen=self._window)).append(seconds * 1000)

    def snapshot(self) -> dict:
        with self._lock:
            latency = {}
            for route, values in self._latencies.items():
                ordered = sorted(values)
                latency[route] = {
                    "count": len(ordered),
                    "p50": round(_percentile(ordered, 0.50), 1),
                    "p95": round(_percentile(ordered, 0.95), 1),
                }
            return {
                "uptime_s": round(time.time() - self._started),
                "counters": dict(self._counters),
                "latency_ms": latency,
            }


METRICS = Metrics()
