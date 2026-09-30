import { useState } from "react";
import type { FindingStatus, Report } from "../types";
import { Plaqueta } from "./Plaqueta";

const LABEL: Record<FindingStatus, string> = {
  pendente: "Pendente",
  decisao_humana: "Decisão do profissional",
  nao_informado: "Não informado",
  atendido: "Atendido",
};

const BAR: Record<FindingStatus, string> = {
  pendente: "border-perigo",
  decisao_humana: "border-atencao",
  nao_informado: "border-aco",
  atendido: "border-seguro",
};

const TEXT: Record<FindingStatus, string> = {
  pendente: "text-perigo",
  decisao_humana: "text-atencao",
  nao_informado: "text-aco",
  atendido: "text-seguro",
};

const ORDER: FindingStatus[] = ["pendente", "decisao_humana", "nao_informado", "atendido"];

interface Props {
  report: Report;
  onDownload: () => Promise<void>;
  onRestart: () => void;
}

export function ReportCard({ report, onDownload, onRestart }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const textOf = new Map(report.requirements.map((r) => [r.ref, r.text]));
  const findings = ORDER.flatMap((status) => report.findings.filter((f) => f.status === status));

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await onDownload();
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="relatorio" className="chegada rounded-lg border border-grafite bg-papel">
      <header className="border-b border-linha px-4 py-3">
        <h2 id="relatorio" className="font-display text-xl font-bold">
          Relatório de conformidade
        </h2>
        <p className="text-sm text-aco">{report.norms.map((n) => `${n.norm} ${n.title}`).join("; ")}</p>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-linha bg-linha sm:grid-cols-4">
        {ORDER.map((status) => (
          <div key={status} className="bg-papel px-4 py-2.5">
            <dt className="text-sm text-aco">{LABEL[status]}</dt>
            <dd className={`font-display text-2xl font-bold ${TEXT[status]}`}>
              {report.findings.filter((f) => f.status === status).length}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-linha">
        {findings.map((finding) => (
          <li key={finding.ref} className={`border-l-4 px-4 py-3 ${BAR[finding.status]}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-display font-semibold ${TEXT[finding.status]}`}>{LABEL[finding.status]}</span>
              <Plaqueta refText={finding.ref} />
            </div>
            {textOf.get(finding.ref) && (
              <p className="mt-1.5 line-clamp-3 text-sm italic text-aco">{textOf.get(finding.ref)}</p>
            )}
            <p className="mt-1">{finding.justification}</p>
          </li>
        ))}
      </ul>

      <footer className="space-y-3 border-t border-linha px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-md bg-grafite px-4 py-2.5 font-display font-semibold text-papel hover:bg-black disabled:opacity-60"
          >
            {downloading ? "Gerando PDF…" : "Baixar relatório em PDF"}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-md border border-grafite px-4 py-2.5 font-display font-semibold hover:bg-concreto"
          >
            Nova conferência
          </button>
        </div>
        {downloadError && (
          <p role="alert" className="text-sm text-perigo">
            {downloadError}
          </p>
        )}
        <p className="text-sm text-aco">
          Corpus normativo capturado em {new Date(`${report.corpus_date}T12:00:00`).toLocaleDateString("pt-BR")}.{" "}
          {report.disclaimer}
        </p>
      </footer>
    </section>
  );
}
