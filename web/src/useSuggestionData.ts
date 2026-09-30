import { useEffect, useState } from "react";
import type { SuggestionData } from "./suggest";

const EMPTY: SuggestionData = { activities: [], terms: [], norms: [] };

/** Arquivo estático gerado pela ingestão; se não carregar, o chat funciona sem sugestões. */
export function useSuggestionData(): SuggestionData {
  const [data, setData] = useState<SuggestionData>(EMPTY);
  useEffect(() => {
    let active = true;
    fetch("/suggestions.json")
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((loaded: SuggestionData) => active && setData(loaded))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return data;
}
