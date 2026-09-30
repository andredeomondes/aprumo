import { useEffect, useRef } from "react";
import { Composer } from "./components/Composer";
import { MessageBubble } from "./components/MessageBubble";
import { ReportCard } from "./components/ReportCard";
import { useAssessment } from "./state/useAssessment";

export default function App() {
  const { state, busy, slow, send, retry, downloadPdf, reset } = useAssessment();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages.length, state.phase, busy]);

  const canRetry = state.phase === "evaluating" && state.failed;
  const composing = state.phase === "describe" || state.phase === "asking" || state.phase === "analyzing";

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-grafite pb-3 pt-5">
        <div>
          <h1 className="font-display text-[1.75rem] font-bold leading-none">Aprumo</h1>
          <p className="mt-1 text-sm text-aco">Conferência de requisitos das NRs antes da atividade</p>
        </div>
        {state.phase !== "describe" && (
          <button type="button" onClick={reset} className="text-sm text-aco underline underline-offset-4 hover:text-grafite">
            Recomeçar
          </button>
        )}
      </header>

      <main className="flex-1 space-y-4 py-5" aria-live="polite">
        {state.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {busy && (
          <p className="text-aco">
            {state.phase === "analyzing" ? "Consultando as normas…" : "Montando o relatório…"}
            {slow && " O servidor gratuito pode levar até um minuto para acordar na primeira consulta."}
          </p>
        )}

        {canRetry && (
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-grafite px-4 py-2 font-display font-semibold hover:bg-papel"
          >
            Tentar de novo
          </button>
        )}

        {state.report && <ReportCard report={state.report} onDownload={downloadPdf} onRestart={reset} />}
        <div ref={endRef} />
      </main>

      <footer className="sticky bottom-0 -mx-4 border-t border-linha bg-concreto px-4 pb-4 pt-3">
        {composing && <Composer phase={state.phase} disabled={busy} onSend={send} />}
        <p className="mt-2 text-xs text-aco">
          Apoio à conferência. Não substitui profissional habilitado nem a leitura da norma. Não informe dados
          pessoais: o que parecer CPF, e-mail ou telefone é mascarado antes da análise.
        </p>
      </footer>
    </div>
  );
}
