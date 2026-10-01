import { useEffect, useState } from "react";

export type Page = "conferencia" | "historico" | "normas" | "painel";

function readPage(): Page {
  const hash = window.location.hash.replace("#", "");
  return hash === "historico" || hash === "normas" || hash === "painel" ? hash : "conferencia";
}

/** Mantém o roteamento simples por hash isolado da composição visual da aplicação. */
export function usePage(): Page {
  const [page, setPage] = useState<Page>(readPage);

  useEffect(() => {
    const update = () => setPage(readPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return page;
}
