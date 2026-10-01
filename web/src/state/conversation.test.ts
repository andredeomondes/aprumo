import { describe, expect, it } from "vitest";
import type { Analysis, Turn } from "../types";
import { initialState, reducer, type State } from "./assessment";

const analysis: Analysis = {
  status: "ok",
  message: "Entendi: troca de luminária em poste. Isso combina NR-35 e NR-10.",
  norms: [{ norm: "NR-35", title: "Trabalho em Altura", share: 1 }],
  requirements: [],
  questions: [
    { id: "q1", text: "Há proteção contra quedas?", refs: ["NR-35 item 35.5.1"], section: "controles" },
    { id: "q2", text: "O circuito será desligado?", refs: ["NR-10 item 10.5.1"], section: "controles" },
  ],
  risk_context: [],
};

const turn = (partial: Partial<Turn> = {}): Turn => ({ answered: true, reply: "", follow_up: null, ...partial });

function asking(): State {
  return reducer(reducer(initialState, { type: "activity", text: "Troca de luminária em poste" }), { type: "analysis", analysis });
}

function say(state: State, text: string, result: Turn): State {
  return reducer(reducer(state, { type: "said", text }), { type: "turn", text, turn: result });
}

describe("conversa por turnos", () => {
  it("enquanto o assistente pensa, a fala do usuário já aparece", () => {
    const state = reducer(asking(), { type: "said", text: "Sim" });
    expect(state.conversing).toBe(true);
    expect(state.messages.at(-1)).toMatchObject({ role: "user", text: "Sim" });
  });

  it("resposta comum: o assistente reage e passa para a próxima pergunta", () => {
    const state = say(asking(), "Sim, com cinto e talabarte", turn({ reply: "Registrei o cinto com talabarte." }));
    expect(state.questionIndex).toBe(1);
    expect(state.answers).toEqual([{ question: "Há proteção contra quedas?", answer: "Sim, com cinto e talabarte" }]);
    expect(state.messages.at(-2)?.text).toBe("Registrei o cinto com talabarte.");
    expect(state.messages.at(-1)).toMatchObject({ kind: "question", text: "O circuito será desligado?" });
  });

  it("dúvida do usuário: explica e continua na mesma pergunta, sem registrar resposta", () => {
    const state = say(asking(), "o que é SPIQ?", turn({ answered: false, reply: "É o sistema individual contra quedas. Ele estará montado?" }));
    expect(state.questionIndex).toBe(0);
    expect(state.answers).toEqual([]);
    expect(state.messages.at(-1)?.text).toContain("sistema individual");
  });

  it("resposta negativa: aprofunda uma vez e junta o complemento na mesma resposta", () => {
    let state = say(asking(), "Não", turn({ reply: "Anotado.", follow_up: "O que falta e quem resolve?" }));
    expect(state.questionIndex).toBe(0);
    expect(state.followUp).toBe("O que falta e quem resolve?");
    expect(state.messages.at(-1)).toMatchObject({ kind: "followup", text: "O que falta e quem resolve?" });

    state = say(state, "Falta a linha de vida, o João instala até sexta", turn({ reply: "Certo." }));
    expect(state.followUp).toBeNull();
    expect(state.questionIndex).toBe(1);
    expect(state.answers).toEqual([
      { question: "Há proteção contra quedas?", answer: "Não\nComplemento: Falta a linha de vida, o João instala até sexta" },
    ]);
  });

  it("um segundo aprofundamento na mesma pergunta é ignorado", () => {
    let state = say(asking(), "Não", turn({ follow_up: "O que falta?" }));
    state = say(state, "Não sei", turn({ follow_up: "E quem sabe?" }));
    expect(state.questionIndex).toBe(1);
  });

  it("última resposta leva à avaliação", () => {
    const state = say(say(asking(), "Sim", turn()), "Sim", turn());
    expect(state.phase).toBe("evaluating");
    expect(state.answers).toHaveLength(2);
  });

  it("dá para encerrar antes e gerar o relatório com o que já foi respondido", () => {
    const state = reducer(say(asking(), "Sim", turn()), { type: "finish" });
    expect(state.phase).toBe("evaluating");
    expect(state.answers).toHaveLength(1);
    expect(reducer(asking(), { type: "finish" }).phase).toBe("asking");
  });
});
