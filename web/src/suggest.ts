export interface SuggestionData {
  activities: string[];
  terms: string[];
}

export interface Suggestion {
  kind: "activity" | "term";
  label: string;
  /** Trecho do fim do texto que a sugestão substitui (só para termos). */
  replaces: string;
}

const MAX_ACTIVITIES = 3;
const MAX_TOTAL = 6;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function words(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function matchActivities(text: string, activities: string[]): Suggestion[] {
  const query = words(text).filter((w) => w.length >= 2);
  if (query.length === 0) return [];
  const last = query[query.length - 1];
  const complete = query.slice(0, -1);
  return activities
    .filter((activity) => {
      const target = words(activity);
      // Palavras completas precisam aparecer; a última pode estar pela metade.
      return complete.every((w) => target.some((t) => t.startsWith(w))) && target.some((t) => t.startsWith(last));
    })
    .slice(0, MAX_ACTIVITIES)
    .map((label) => ({ kind: "activity" as const, label, replaces: text }));
}

function matchTerms(text: string, terms: string[]): Suggestion[] {
  const tokens = text.split(/\s+/);
  const typed = normalize(text);
  const found: Suggestion[] = [];
  // Tenta o fim do texto com 3, 2 e 1 palavra: "permissao de tra" → "permissão de trabalho".
  for (let size = Math.min(3, tokens.length); size >= 1 && found.length < MAX_TOTAL; size -= 1) {
    const tail = tokens.slice(-size).join(" ");
    const needle = normalize(tail);
    if (needle.replace(/\s/g, "").length < 2) continue;
    for (const term of terms) {
      const normalized = normalize(term);
      if (normalized.startsWith(needle) && normalized !== needle && !typed.includes(normalized)) {
        if (!found.some((s) => s.label === term)) found.push({ kind: "term", label: term, replaces: tail });
      }
      if (found.length >= MAX_TOTAL) break;
    }
  }
  return found;
}

/** Sugestões locais, sem rede: atividades comuns (só na descrição) e termos técnicos das NRs. */
export function suggest(text: string, data: SuggestionData, describing: boolean): Suggestion[] {
  if (text.trim().length < 2) return [];
  const activities = describing ? matchActivities(text, data.activities) : [];
  const terms = matchTerms(text.trimStart(), data.terms);
  return [...activities, ...terms].slice(0, MAX_TOTAL);
}

export function applySuggestion(text: string, suggestion: Suggestion): string {
  if (suggestion.kind === "activity") return suggestion.label;
  const cut = text.length - suggestion.replaces.length;
  return `${text.slice(0, cut)}${suggestion.label} `;
}
