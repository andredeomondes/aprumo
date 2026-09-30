import { useMemo, useState } from "react";
import type { NormEntry } from "../suggest";

function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** As 36 NRs vigentes na base, com a quantidade de itens de cada uma. */
export function NormsCatalog({ norms }: { norms: NormEntry[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = plain(query.trim());
    return q ? norms.filter((n) => plain(`${n.code} ${n.title}`).includes(q)) : norms;
  }, [norms, query]);
  const total = norms.reduce((sum, n) => sum + n.items, 0);

  return (
    <div className="page">
      <div className="page-inner">
        <h1>Normas na base</h1>
        <p className="page-lede">
          {norms.length} Normas Regulamentadoras vigentes, {total.toLocaleString("pt-BR")} itens numerados. Texto
          consolidado baixado das páginas oficiais do Ministério do Trabalho e Emprego; cada item é a unidade de busca e
          de citação.
        </p>
        <label className="sr-only" htmlFor="busca-normas">
          Filtrar normas
        </label>
        <input
          id="busca-normas"
          className="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por número ou tema, ex.: altura, NR-12"
        />
        <div className="catalog">
          {visible.map((norm) => (
            <article key={norm.code}>
              <strong>{norm.code}</strong>
              <div>
                <p>{norm.title}</p>
                <small>{norm.items.toLocaleString("pt-BR")} itens</small>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && <p className="muted-note">Nenhuma norma com esse termo.</p>}
      </div>
    </div>
  );
}
