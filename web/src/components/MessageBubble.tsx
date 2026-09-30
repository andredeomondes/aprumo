import type { ChatMessage } from "../state/assessment";
import { Plaqueta } from "./Plaqueta";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="chegada flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-grafite px-4 py-2.5 text-papel">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <p role="alert" className="chegada border-l-4 border-perigo bg-papel px-4 py-2.5 text-grafite">
        {message.text}
      </p>
    );
  }

  if (message.kind === "question") {
    return (
      <div className="chegada border-l-4 border-sinal bg-papel px-4 py-3">
        <p className="text-sm text-aco">
          Pergunta {message.step} de {message.total}
        </p>
        <p className="mt-1 text-[1.125rem] font-medium leading-snug">{message.text}</p>
        {message.refs && message.refs.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.refs.map((ref) => (
              <Plaqueta key={ref} refText={ref} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <p className={`chegada max-w-[65ch] ${message.kind === "summary" ? "font-medium" : "text-aco"}`}>
      {message.text}
    </p>
  );
}
