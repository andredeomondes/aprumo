import { useCallback, useEffect, useRef, useState } from "react";

export type NoticeTone = "info" | "error";

export interface Notice {
  id: number;
  text: string;
  tone: NoticeTone;
  durationMs: number;
}

const INFO_DURATION_MS = 4_800;
const ERROR_DURATION_MS = 7_000;

/** Controla feedback transitório sem misturar temporizadores com o layout da aplicação. */
export function useTransientNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(0);
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  }, []);

  const show = useCallback((text: string, tone: NoticeTone = "info", durationMs?: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const id = ++nextId.current;
    const resolvedDuration = durationMs ?? (tone === "error" ? ERROR_DURATION_MS : INFO_DURATION_MS);
    setNotice({ id, text, tone, durationMs: resolvedDuration });
    timer.current = window.setTimeout(() => {
      setNotice((current) => (current?.id === id ? null : current));
      timer.current = null;
    }, resolvedDuration);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return { notice, show, dismiss };
}
