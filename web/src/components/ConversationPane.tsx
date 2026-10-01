import { FileCheck2, Info, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatMessage, State } from "../state/assessment";
import type { SuggestionData } from "../suggest";
import { BrandMark } from "./BrandMark";
import { Composer } from "./Composer";

const QUICK_ANSWERS = ["Sim", "Não", "Não sei"] as const;
const SECTION_LABEL = {
  planejamento: "Planejamento",
  pessoas: "Equipe e responsabilidades",
  controles: "Medidas de controle",
  execucao: "Acompanhamento da execução",
  emergencia: "Emergência e encerramento",
} as const;
/** A partir de quantas respostas já dá para encerrar e gerar um relatório útil. */
const MIN_ANSWERS_TO_FINISH = 3;

interface Props {
  state: State;
  busy: boolean;
  slow: boolean;
  data: SuggestionData;
  mobileActive: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
  onReset: () => void;
  onFinish: () => void;
}

function Message({ message, norms }: { message: ChatMessage; norms?: string[] }) {
  if (message.role === "user") {
    return (
      <article className="message user">
        <div className="message-body">
          <p>{message.text}</p>
        </div>
      </article>
    );
  }
  const asksSomething = message.kind === "question" || message.kind === "followup";
  return (
    <article className={`message assistant ${message.kind === "error" ? "error" : ""} ${asksSomething ? "asks" : ""}`}>
      <span className="assistant-avatar">
        <BrandMark compact />
      </span>
      <div className="message-body">
        {message.kind === "question" && message.section && (
          <span className="message-step">
            {SECTION_LABEL[message.section]} · Pergunta {message.step} de {message.total}
          </span>
        )}
        <p>{message.text}</p>
        {message.kind === "summary" && norms && norms.length > 0 && (
          <div className="inline-tags">
            {norms.map((norm) => (
              <span key={norm}>{norm}</span>
            ))}
          </div>
        )}
        {asksSomething && message.refs && message.refs.length > 0 && (
          <div className="question-refs">
            {message.refs.map((ref) => (
              <span className="ref-tag" key={ref}>
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ConversationPane({ state, busy, slow, data, mobileActive, onSend, onRetry, onReset, onFinish }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const asking = state.phase === "asking";
  const composing = state.phase === "describe" || asking || state.phase === "analyzing";
  const canFinish = asking && !busy && state.answers.length >= MIN_ANSWERS_TO_FINISH;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages.length, busy]);

  const thinking =
    state.phase === "analyzing" ? "Consultando as normas…" : state.conversing ? "Anotando sua resposta…" : "Redigindo o relatório…";

  return (
    <section className={`conversation-pane ${mobileActive ? "mobile-active" : ""}`} aria-labelledby="conversation-title">
      <header className="pane-header">
        <div>
          <h1 id="conversation-title">{state.activity ? "Conferência em andamento" : "Nova conferência"}</h1>
          <p>Uma conversa sobre a atividade, norma por norma. No fim sai a minuta do relatório técnico.</p>
        </div>
        {state.phase !== "describe" && (
          <button type="button" className="secondary-button" onClick={onReset}>
            <RotateCcw size={14} />
            <span>Recomeçar</span>
          </button>
        )}
      </header>

      <div className="conversation-scroll" aria-live="polite">
        <div className="conversation-disclaimer">
          <Info size={14} />
          Apoio à conferência: valide as decisões com o profissional responsável.
        </div>
        {state.messages.map((message) => (
          <Message key={message.id} message={message} norms={state.analysis?.norms.map((n) => n.norm)} />
        ))}

        {busy && (
          <div className="thinking" role="status">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {thinking}
            {slow && " O servidor gratuito pode levar até um minuto para acordar."}
          </div>
        )}

        {state.phase === "evaluating" && state.failed && (
          <div className="answer-row">
            <button type="button" onClick={onRetry}>
              Tentar de novo
            </button>
          </div>
        )}
        <div ref={end} />
      </div>

      {composing ? (
        <div className="composer-stack">
          {asking && (
            <div className="quick-row">
              <div className="answer-row" role="group" aria-label="Resposta rápida">
                {QUICK_ANSWERS.map((answer) => (
                  <button key={answer} type="button" disabled={busy} onClick={() => onSend(answer)}>
                    {answer}
                  </button>
                ))}
              </div>
              {canFinish && (
                <button type="button" className="finish-link" onClick={onFinish}>
                  <FileCheck2 size={14} />
                  Gerar relatório com o que já respondi
                </button>
              )}
            </div>
          )}
          <Composer describing={state.phase === "describe"} disabled={busy} data={data} onSend={onSend} />
        </div>
      ) : (
        <div className="composer-area">
          <p className="composer-help">
            {state.phase === "done" ? "Conferência concluída. Preencha empresa, local e responsável no painel do relatório e baixe o PDF." : " "}
          </p>
        </div>
      )}
    </section>
  );
}
