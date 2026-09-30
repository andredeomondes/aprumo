import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { api } from "../api";
import type { Analysis, QA } from "../types";
import { initialState, reducer } from "./assessment";

const SLOW_AFTER_MS = 6000;

/** Liga a conversa (reducer puro) às chamadas de rede. As chamadas saem dos handlers,
 *  não de efeitos, para o StrictMode não disparar o modelo duas vezes. */
export function useAssessment() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [slow, setSlow] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => api.warmUp(), []);

  const busy = state.phase === "analyzing" || (state.phase === "evaluating" && !state.failed);

  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  const runEvaluation = useCallback(async (activity: string, analysis: Analysis, answers: QA[]) => {
    try {
      dispatch({ type: "report", report: await api.evaluate(activity, analysis.requirements, answers) });
    } catch (error) {
      dispatch({ type: "failed", message: (error as Error).message });
    }
  }, []);

  const send = useCallback(async (text: string) => {
    const current = stateRef.current;
    if (current.phase === "describe") {
      dispatch({ type: "activity", text });
      try {
        dispatch({ type: "analysis", analysis: await api.analyze(text) });
      } catch (error) {
        dispatch({ type: "failed", message: (error as Error).message });
      }
      return;
    }
    if (current.phase === "asking" && current.analysis) {
      dispatch({ type: "answer", text });
      const question = current.analysis.questions[current.questionIndex];
      const answers = [...current.answers, { question: question.text, answer: text }];
      if (answers.length === current.analysis.questions.length) {
        await runEvaluation(current.activity, current.analysis, answers);
      }
    }
  }, [runEvaluation]);

  const retry = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== "evaluating" || !current.analysis) return;
    dispatch({ type: "retry" });
    await runEvaluation(current.activity, current.analysis, current.answers);
  }, [runEvaluation]);

  const downloadPdf = useCallback(async () => {
    const report = stateRef.current.report;
    if (!report) return;
    const url = URL.createObjectURL(await api.reportPdf(report));
    const link = Object.assign(document.createElement("a"), { href: url, download: "aprumo-relatorio.pdf" });
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, busy, slow, send, retry, downloadPdf, reset };
}
