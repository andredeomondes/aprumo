import { Send } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { applySuggestion, suggest, type Suggestion, type SuggestionData } from "../suggest";

const EXAMPLES = [
  "Troca de luminária em poste a 7 metros, perto da rede de baixa tensão",
  "Limpeza interna de tanque de armazenamento de combustível",
  "Içamento de motor com ponte rolante para manutenção da prensa",
];

interface Props {
  describing: boolean;
  disabled: boolean;
  data: SuggestionData;
  onSend: (text: string) => void;
}

/** Campo de mensagem com autocompletar local: atividades comuns e termos técnicos das NRs. */
export function Composer({ describing, disabled, data, onSend }: Props) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
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
    field.current?.focus();
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    change("");
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
    <div className="composer-area">
      {describing && !disabled && text.length === 0 && (
        <div className="examples" aria-label="Exemplos de atividade">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => change(example)}>
              {example}
            </button>
          ))}
        </div>
      )}
      {open && (
        <ul id="sugestoes" className="suggestions" role="listbox" aria-label="Sugestões">
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
            >
              <span className="kind">{suggestion.kind === "activity" ? "Atividade" : "Termo"}</span>
              <span>{suggestion.label}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="mensagem">
          {describing ? "Descrição da atividade" : "Sua resposta"}
        </label>
        <textarea
          id="mensagem"
          ref={field}
          rows={describing ? 2 : 1}
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
          placeholder={describing ? "Descreva a atividade: o que, onde e com quais equipamentos" : "Detalhe a resposta, se quiser"}
        />
        <button type="submit" disabled={!canSend} aria-label={describing ? "Analisar atividade" : "Enviar resposta"}>
          <Send size={18} />
        </button>
      </form>
      <p className="composer-help">
        {open ? "Setas para escolher, Tab para aceitar, Esc para fechar." : "Enter envia, Shift+Enter quebra a linha."}
      </p>
    </div>
  );
}
