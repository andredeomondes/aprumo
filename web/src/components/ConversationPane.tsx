import { Info, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatMessage, State } from "../state/assessment";
import type { SuggestionData } from "../suggest";
import { BrandMark } from "./BrandMark";
import { Composer } from "./Composer";

const QUICK_ANSWERS = ["Sim", "Não", "Não sei"] as const;

interface Props {
  state: State;
  busy: boolean;
  slow: boolean;
  data: SuggestionData;
  mobileActive: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
  onReset: () => void;
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
  return (
    <article className={`message assistant ${message.kind === "error" ? "error" : ""}`}>
      <span className="assistant-avatar">
        <BrandMark compact />
      </span>
      <div className="message-body">
        <p>{message.text}</p>
        {message.kind === "summary" && norms && norms.length > 0 && (
          <div className="inline-tags">
            {norms.map((norm) => (
              <span key={norm}>{norm}</span>
            ))}
          </div>
        )}
        {message.kind === "question" && message.refs && (
          <div className="inline-tags">
            {message.refs.map((ref) => (
              <span key={ref}>{ref}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ConversationPane({ state, busy, slow, data, mobileActive, onSend, onRetry, onReset }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const asking = state.phase === "asking" && state.analysis;
  const question = asking ? state.analysis!.questions[state.questionIndex] : null;
  // A pergunta atual aparece no cartão, não repetida como mensagem.
  const history = question ? state.messages.slice(0, -1) : state.messages;
  const composing = state.phase === "describe" || state.phase === "asking" || state.phase === "analyzing";

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages.length, busy]);

  return (
    <section className={`conversation-pane ${mobileActive ? "mobile-active" : ""}`} aria-labelledby="conversation-title">
      <header className="pane-header">
        <div>
          <h1 id="conversation-title">{state.activity ? "Conferência em andamento" : "Nova conferência"}</h1>
          <p>Descreva a atividade. O Aprumo identifica as normas aplicáveis e pergunta sobre os requisitos.</p>
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
        {history.map((message) => (
          <Message key={message.id} message={message} norms={state.analysis?.norms.map((n) => n.norm)} />
        ))}

        {question && (
          <section className="question-card" aria-labelledby="question-title">
            <div className="question-kicker">
              Pergunta {state.questionIndex + 1} de {state.analysis!.questions.length}
            </div>
            <h2 id="question-title">{question.text}</h2>
            <div className="question-refs">
              {question.refs.map((ref) => (
                <span className="ref-tag" key={ref}>
                  {ref}
                </span>
              ))}
            </div>
            <div className="answer-row" role="group" aria-label="Resposta rápida">
              {QUICK_ANSWERS.map((answer) => (
                <button key={answer} type="button" disabled={busy} onClick={() => onSend(answer)}>
                  {answer}
                </button>
              ))}
            </div>
            <p className="answer-help">Respostas detalhadas geram uma avaliação mais precisa. Use o campo abaixo.</p>
          </section>
        )}

        {busy && (
          <div className="thinking" role="status">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {state.phase === "analyzing" ? "Consultando as normas…" : "Montando o relatório…"}
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
        <Composer describing={state.phase === "describe"} disabled={busy} data={data} onSend={onSend} />
      ) : (
        <div className="composer-area">
          <p className="composer-help">
            {state.phase === "done" ? "Conferência concluída. Veja o relatório ao lado." : " "}
          </p>
        </div>
      )}
    </section>
  );
}
