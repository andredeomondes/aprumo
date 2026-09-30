import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { Phase } from "../state/assessment";

const EXAMPLES = [
  "Troca de luminária em poste a 7 metros, perto da rede de baixa tensão",
  "Limpeza interna de tanque de armazenamento de combustível",
  "Manutenção em prensa hidráulica com troca de matriz",
];

interface Props {
  phase: Phase;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function Composer({ phase, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const describing = phase === "describe";
  const minLength = describing ? 10 : 1;
  const canSend = !disabled && text.trim().length >= minLength;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {describing && !disabled && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="rounded-md border border-linha bg-papel px-2.5 py-1 text-left text-sm text-aco hover:border-aco hover:text-grafite"
            >
              {example}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="mensagem">
          {describing ? "Descrição da atividade" : "Sua resposta"}
        </label>
        <textarea
          id="mensagem"
          rows={describing ? 3 : 2}
          value={text}
          maxLength={2000}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={describing ? "Ex.: troca de luminária em poste a 7 metros" : "Responda com o que foi ou será feito"}
          className="min-h-[3.25rem] flex-1 resize-none rounded-md border border-linha bg-papel px-3 py-2 text-grafite placeholder:text-aco/70 focus:border-grafite focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="h-[3.25rem] rounded-md bg-grafite px-4 font-display text-base font-semibold text-papel enabled:hover:bg-black disabled:opacity-40"
        >
          {describing ? "Analisar" : "Responder"}
        </button>
      </div>
    </form>
  );
}
