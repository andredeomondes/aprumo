import type { Analysis, QA, QuestionSection, Report, SectorTrend, Turn } from "../types";

export type Phase = "describe" | "analyzing" | "asking" | "evaluating" | "done";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "summary" | "question" | "followup" | "reply" | "error";
  refs?: string[];
  step?: number;
  total?: number;
  section?: QuestionSection;
  trends?: SectorTrend[];
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
  /** Aprofundamento em aberto da pergunta atual; no máximo um por pergunta. */
  followUp: string | null;
  /** O usuário falou e o assistente ainda não respondeu. */
  conversing: boolean;
}

export type Action =
  | { type: "activity"; text: string }
  | { type: "analysis"; analysis: Analysis }
  | { type: "answer"; text: string }
  | { type: "said"; text: string }
  | { type: "turn"; text: string; turn: Turn }
  | { type: "finish" }
  | { type: "report"; report: Report }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "reset" };

const GREETING =
  "Me conta o que vai ser feito: qual é a atividade, onde e com quais equipamentos. " +
  "Eu identifico as normas que se aplicam e a gente conversa sobre os pontos que precisam estar em ordem antes de começar.";

export const initialState: State = {
  phase: "describe",
  messages: [{ id: 0, role: "assistant", text: GREETING }],
  activity: "",
  questionIndex: 0,
  answers: [],
  attempt: 0,
  failed: false,
  followUp: null,
  conversing: false,
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
    section: question.section,
  });
}

/** Registra a resposta da pergunta atual e segue: próxima pergunta ou avaliação. */
function advance(state: State, answers: QA[], messages: ChatMessage[]): State {
  const analysis = state.analysis!;
  const next = state.questionIndex + 1;
  const base = { ...state, answers, followUp: null, conversing: false };
  if (next >= analysis.questions.length) return { ...base, phase: "evaluating", messages };
  return { ...base, questionIndex: next, messages: askQuestion(messages, analysis, next) };
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
      const messages = append(state.messages, {
        role: "assistant",
        kind: "summary",
        text: analysis.message,
        trends: analysis.risk_context ?? [],
      });
      if (analysis.status === "sem_base" || analysis.questions.length === 0) {
        return { ...state, phase: "describe", messages };
      }
      return {
        ...state,
        phase: "asking",
        analysis,
        questionIndex: 0,
        answers: [],
        followUp: null,
        messages: askQuestion(messages, analysis, 0),
      };
    }

    // Resposta direta, sem turno de conversa: usada quando o assistente não está disponível.
    case "answer": {
      if (!state.analysis) return state;
      const question = state.analysis.questions[state.questionIndex];
      const answers = [...state.answers, { question: question.text, answer: action.text }];
      return advance(state, answers, append(state.messages, { role: "user", text: action.text }));
    }

    case "said":
      return { ...state, conversing: true, messages: append(state.messages, { role: "user", text: action.text }) };

    case "turn": {
      if (!state.analysis || state.phase !== "asking") return state;
      const { turn, text } = action;
      const replied = turn.reply ? append(state.messages, { role: "assistant", kind: "reply", text: turn.reply }) : state.messages;
      // Dúvida ou outro assunto: explica e continua na mesma pergunta, sem registrar resposta.
      if (!turn.answered) return { ...state, conversing: false, messages: replied };

      const question = state.analysis.questions[state.questionIndex];
      const answers =
        state.followUp === null
          ? [...state.answers, { question: question.text, answer: text }]
          : state.answers.map((qa, index) =>
              index === state.answers.length - 1 ? { ...qa, answer: `${qa.answer}\nComplemento: ${text}` } : qa,
            );
      if (turn.follow_up && state.followUp === null) {
        return {
          ...state,
          answers,
          conversing: false,
          followUp: turn.follow_up,
          messages: append(replied, { role: "assistant", kind: "followup", text: turn.follow_up, refs: question.refs }),
        };
      }
      return advance(state, answers, replied);
    }

    case "finish":
      return state.phase === "asking" && state.answers.length > 0
        ? { ...state, phase: "evaluating", followUp: null, conversing: false }
        : state;

    case "report":
      return { ...state, phase: "done", report: action.report };

    case "failed":
      return {
        ...state,
        failed: true,
        conversing: false,
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
