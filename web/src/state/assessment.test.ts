import { describe, expect, it } from "vitest";
import type { Analysis, Report } from "../types";
import { initialState, reducer, type State } from "./assessment";

const analysis: Analysis = {
  status: "ok",
  message: "Normas aplicáveis: NR-35. Vou fazer 2 perguntas.",
  norms: [{ norm: "NR-35", title: "Trabalho em Altura", share: 1 }],
  requirements: [],
  questions: [
    { id: "q1", text: "Há linha de vida?", refs: ["NR-35 item 35.5.1"] },
    { id: "q2", text: "Houve análise de risco?", refs: ["NR-35 item 35.4.5"] },
  ],
};

const report = { findings: [] } as unknown as Report;

function asking(): State {
  const described = reducer(initialState, { type: "activity", text: "Troca de lâmpada a 6 m" });
  return reducer(described, { type: "analysis", analysis });
}

describe("conversa", () => {
  it("descrição leva à análise e depois à primeira pergunta", () => {
    const described = reducer(initialState, { type: "activity", text: "Troca de lâmpada a 6 m" });
    expect(described.phase).toBe("analyzing");
    const state = reducer(described, { type: "analysis", analysis });
    expect(state.phase).toBe("asking");
    expect(state.messages.at(-1)).toMatchObject({ text: "Há linha de vida?", kind: "question", step: 1, total: 2 });
  });

  it("última resposta leva à avaliação com todas as respostas", () => {
    let state = reducer(asking(), { type: "answer", text: "Sim" });
    expect(state.phase).toBe("asking");
    state = reducer(state, { type: "answer", text: "Não" });
    expect(state.phase).toBe("evaluating");
    expect(state.answers).toEqual([
      { question: "Há linha de vida?", answer: "Sim" },
      { question: "Houve análise de risco?", answer: "Não" },
    ]);
  });

  it("sem base volta a pedir descrição", () => {
    const described = reducer(initialState, { type: "activity", text: "receita de bolo" });
    const state = reducer(described, {
      type: "analysis",
      analysis: { ...analysis, status: "sem_base", message: "Não encontrei base", questions: [] },
    });
    expect(state.phase).toBe("describe");
    expect(state.messages.at(-1)?.text).toBe("Não encontrei base");
  });

  it("falha na avaliação preserva respostas e permite tentar de novo", () => {
    let state = reducer(reducer(asking(), { type: "answer", text: "Sim" }), { type: "answer", text: "Não" });
    state = reducer(state, { type: "failed", message: "fora do ar" });
    expect(state.phase).toBe("evaluating");
    expect(state.messages.at(-1)?.kind).toBe("error");
    expect(state.failed).toBe(true);
    const retried = reducer(state, { type: "retry" });
    expect(retried.attempt).toBe(state.attempt + 1);
    expect(retried.answers).toHaveLength(2);
    expect(retried.failed).toBe(false);
  });

  it("falha na análise volta para a descrição", () => {
    const described = reducer(initialState, { type: "activity", text: "Troca de lâmpada a 6 m" });
    expect(reducer(described, { type: "failed", message: "x" }).phase).toBe("describe");
  });

  it("relatório encerra a conversa", () => {
    let state = reducer(reducer(asking(), { type: "answer", text: "Sim" }), { type: "answer", text: "Não" });
    state = reducer(state, { type: "report", report });
    expect(state.phase).toBe("done");
    expect(state.report).toBe(report);
  });
});
