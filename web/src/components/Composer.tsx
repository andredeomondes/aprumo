import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Phase } from "../state/assessment";
import { applySuggestion, suggest, type Suggestion } from "../suggest";
import { useSuggestionData } from "../useSuggestionData";

const EXAMPLES = [
  "Troca de luminária em poste a 7 metros, perto da rede de baixa tensão",
  "Limpeza interna de tanque de armazenamento de combustível",
  "Içamento de motor com ponte rolante para manutenção da prensa",
];

interface Props {
  phase: Phase;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function Composer({ phase, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const data = useSuggestionData();
  const describing = phase === "describe";
  const minLength = describing ? 10 : 1;
  const canSend = !disabled && text.trim().length >= minLength;

  const suggestions = useMemo(
    () => (dismissed || disabled ? [] : suggest(text, data, describing)),
    [text, data, describing, dismissed, disabled],
  );
  const open = suggestions.length > 0;

  function change(value: string) {
    setText(value);
    setActive(-1);
    setDismissed(false);
  }

  function accept(suggestion: Suggestion) {
    setText(applySuggestion(text, suggestion));
    setActive(-1);
    setDismissed(suggestion.kind === "activity");
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    setActive(-1);
    setDismissed(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (open && event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (open && event.key === "Escape") {
      setDismissed(true);
    } else if (open && active >= 0 && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      accept(suggestions[active]);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {describing && !disabled && text.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => change(example)}
              className="rounded-md border border-linha bg-papel px-2.5 py-1 text-left text-sm text-aco hover:border-aco hover:text-grafite"
            >
              {example}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-2">
        <label className="sr-only" htmlFor="mensagem">
          {describing ? "Descrição da atividade" : "Sua resposta"}
        </label>
        {open && (
          <ul
            id="sugestoes"
            role="listbox"
            aria-label="Sugestões"
            className="absolute bottom-full left-0 right-24 mb-1.5 max-h-64 overflow-auto rounded-md border border-grafite bg-papel py-1 shadow-[0_6px_20px_rgb(28_35_33/0.12)]"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.kind}-${suggestion.label}`}
                id={`sugestao-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(suggestion);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${index === active ? "bg-concreto" : ""}`}
              >
                <span className="w-16 shrink-0 text-xs text-aco">
                  {suggestion.kind === "activity" ? "Atividade" : "Termo"}
                </span>
                <span>{suggestion.label}</span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          id="mensagem"
          rows={describing ? 3 : 2}
          value={text}
          maxLength={2000}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls="sugestoes"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `sugestao-${active}` : undefined}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setDismissed(true)}
          onFocus={() => setDismissed(false)}
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
      {open && (
        <p className="text-xs text-aco">Setas para escolher, Tab para aceitar, Esc para fechar.</p>
      )}
    </form>
  );
}
