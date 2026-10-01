import { useEffect, useState } from "react";
import { api, type AprumoGateway } from "../api";
import type { MetricsSnapshot } from "../metrics";

export interface MetricsPayload {
  ai: MetricsSnapshot;
  budget: { limit: number; used: number };
}

const REFRESH_MS = 10_000;

/** Caso de uso do painel operacional; mantém transporte e polling fora do componente visual. */
export function useMetrics(onError: (message: string) => void, gateway: AprumoGateway = api) {
  const [data, setData] = useState<MetricsPayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      gateway
        .metrics()
        .then((payload) => {
          if (active) setData(payload as MetricsPayload);
        })
        .catch((error: Error) => {
          if (active) onError(error.message);
        });

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gateway, onError]);

  return data;
}
