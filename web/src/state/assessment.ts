import type { Analysis, QA, Report } from "../types";

export type Phase = "describe" | "analyzing" | "asking" | "evaluating" | "done";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "summary" | "question" | "error";
  refs?: string[];
  step?: number;
  total?: number;
}

export interface State {
  phase: Phase;
  messages: ChatMessage[];
  activity: string;
  analysis?: Analysis;
  questionIndex: number;
  answers: QA[];
  report?: Report;
  attempt: number;
  failed: boolean;
}

export type Action =
  | { type: "activity"; text: string }
  | { type: "analysis"; analysis: Analysis }
  | { type: "answer"; text: string }
  | { type: "report"; report: Report }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "reset" };

const GREETING =
  "Descreva a atividade planejada: o que será feito, onde e com quais equipamentos. " +
  "Eu identifico as normas aplicáveis e faço algumas perguntas antes de montar o relatório.";

export const initialState: State = {
  phase: "describe",
  messages: [{ id: 0, role: "assistant", text: GREETING }],
  activity: "",
  questionIndex: 0,
  answers: [],
  attempt: 0,
  failed: false,
};

function append(messages: ChatMessage[], message: Omit<ChatMessage, "id">): ChatMessage[] {
  return [...messages, { ...message, id: messages.length }];
}

function askQuestion(messages: ChatMessage[], analysis: Analysis, index: number): ChatMessage[] {
  const question = analysis.questions[index];
  return append(messages, {
    role: "assistant",
    kind: "question",
    text: question.text,
    refs: question.refs,
    step: index + 1,
    total: analysis.questions.length,
  });
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "activity":
      return {
        ...state,
        phase: "analyzing",
        failed: false,
        activity: action.text,
        messages: append(state.messages, { role: "user", text: action.text }),
      };

    case "analysis": {
      const { analysis } = action;
      const messages = append(state.messages, { role: "assistant", kind: "summary", text: analysis.message });
      if (analysis.status === "sem_base" || analysis.questions.length === 0) {
        return { ...state, phase: "describe", messages };
      }
      return {
        ...state,
        phase: "asking",
        analysis,
        questionIndex: 0,
        answers: [],
        messages: askQuestion(messages, analysis, 0),
      };
    }

    case "answer": {
      if (!state.analysis) return state;
      const question = state.analysis.questions[state.questionIndex];
      const answers = [...state.answers, { question: question.text, answer: action.text }];
      const messages = append(state.messages, { role: "user", text: action.text });
      const next = state.questionIndex + 1;
      if (next >= state.analysis.questions.length) {
        return { ...state, phase: "evaluating", answers, messages };
      }
      return { ...state, answers, questionIndex: next, messages: askQuestion(messages, state.analysis, next) };
    }

    case "report":
      return { ...state, phase: "done", report: action.report };

    case "failed":
      return {
        ...state,
        failed: true,
        // Na avaliação, as respostas já dadas não se perdem: dá para tentar de novo.
        phase: state.phase === "evaluating" ? "evaluating" : "describe",
        messages: append(state.messages, { role: "assistant", kind: "error", text: action.message }),
      };

    case "retry":
      return { ...state, attempt: state.attempt + 1, failed: false };

    case "reset":
      return initialState;
  }
}
