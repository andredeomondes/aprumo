import { useCallback, useEffect, useReducer, useState } from "react";
import { api, type AprumoGateway } from "../api";
import type { Analysis, Identification, QA, Turn } from "../types";
import { initialState, reducer } from "./assessment";

const SLOW_AFTER_MS = 6000;

/** Liga a conversa (reducer puro) às chamadas de rede. As chamadas saem dos handlers,
 *  não de efeitos, para o StrictMode não disparar o modelo duas vezes. */
interface UseAssessmentOptions {
  gateway?: AprumoGateway;
  onReportReady?: () => void;
}

export function useAssessment({ gateway = api, onReportReady }: UseAssessmentOptions = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [slow, setSlow] = useState(false);

  useEffect(() => gateway.warmUp(), [gateway]);

  const busy = state.phase === "analyzing" || state.conversing || (state.phase === "evaluating" && !state.failed);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  const runEvaluation = useCallback(async (activity: string, analysis: Analysis, answers: QA[]) => {
    try {
      const report = await gateway.evaluate(activity, analysis.requirements, answers);
      dispatch({ type: "report", report });
      onReportReady?.();
    } catch (error) {
      dispatch({ type: "failed", message: (error as Error).message });
    }
  }, [gateway, onReportReady]);

  const send = useCallback(async (text: string) => {
    const current = state;
    if (current.phase === "describe") {
      setSlow(false);
      dispatch({ type: "activity", text });
      try {
        dispatch({ type: "analysis", analysis: await gateway.analyze(text) });
      } catch (error) {
        dispatch({ type: "failed", message: (error as Error).message });
      }
      return;
    }
    if (current.phase === "asking" && current.analysis && !current.conversing) {
      const question = current.analysis.questions[current.questionIndex];
      dispatch({ type: "said", text });
      // Só os itens que a pergunta verifica vão para o turno: menos tokens e menos risco de desvio.
      const cited = current.analysis.requirements.filter((requirement) => question.refs.includes(requirement.ref));
      let turn: Turn;
      try {
        turn = await gateway.converse(current.activity, question, cited, text, current.followUp === null);
      } catch {
        // Sem assistente, a conversa vira questionário: registra e segue, sem travar o usuário.
        turn = { answered: true, reply: "", follow_up: null };
      }
      const action = { type: "turn", text, turn } as const;
      const next = reducer(reducer(current, { type: "said", text }), action);
      dispatch(action);
      if (next.phase === "evaluating" && next.analysis) {
        setSlow(false);
        await runEvaluation(next.activity, next.analysis, next.answers);
      }
    }
  }, [gateway, runEvaluation, state]);

  const retry = useCallback(async () => {
    const current = state;
    if (current.phase !== "evaluating" || !current.analysis) return;
    setSlow(false);
    dispatch({ type: "retry" });
    await runEvaluation(current.activity, current.analysis, current.answers);
  }, [runEvaluation, state]);

  /** A identificação (empresa, local, responsáveis) entra só no documento, nunca no modelo. */
  const downloadPdf = useCallback(async (identification?: Identification) => {
    const report = state.report;
    if (!report) return;
    const url = URL.createObjectURL(await gateway.reportPdf(identification ? { ...report, identification } : report));
    const link = Object.assign(document.createElement("a"), { href: url, download: "aprumo-relatorio.pdf" });
    link.click();
    URL.revokeObjectURL(url);
  }, [gateway, state.report]);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  /** Encerra a conversa antes do fim e avalia com o que já foi respondido. */
  const finish = useCallback(async () => {
    const next = reducer(state, { type: "finish" });
    if (next.phase !== "evaluating" || !next.analysis) return;
    setSlow(false);
    dispatch({ type: "finish" });
    await runEvaluation(next.activity, next.analysis, next.answers);
  }, [runEvaluation, state]);

  return { state, busy, slow: busy && slow, send, retry, finish, downloadPdf, reset };
}
