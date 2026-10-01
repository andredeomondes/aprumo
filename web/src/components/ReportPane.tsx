import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Download, FileCheck2, HelpCircle, Plus } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { State } from "../state/assessment";
import { countByStatus, STATUS_LABEL, STATUS_ORDER } from "../status";
import type { FindingStatus, Identification } from "../types";

type Tab = "overview" | "norms" | "answers";
const TABS: Tab[] = ["overview", "norms", "answers"];
const TAB_LABEL: Record<Tab, string> = { overview: "Visão geral", norms: "Normas aplicáveis", answers: "Respostas" };

function StatusIcon({ status }: { status: FindingStatus }) {
  if (status === "atendido") return <Check size={16} strokeWidth={3} />;
  if (status === "pendente") return <AlertTriangle size={16} />;
  if (status === "nao_informado") return <HelpCircle size={16} />;
  return <CircleHelp size={16} />;
}

interface Props {
  state: State;
  collapsed: boolean;
  mobileActive: boolean;
  onCollapse: (collapsed: boolean) => void;
  onDownload: (identification?: Identification) => Promise<void>;
  onReset: () => void;
  onError: (message: string) => void;
}

export function ReportPane({ state, collapsed, mobileActive, onCollapse, onDownload, onReset, onError }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<FindingStatus | "all">("all");
  const [open, setOpen] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [identification, setIdentification] = useState<Identification>({ company: "", location: "", responsible: "", reviewer: "" });
  const identify = (field: keyof Identification, value: string) => setIdentification((current) => ({ ...current, [field]: value }));
  const report = state.report;

  const textOf = useMemo(() => new Map((report?.requirements ?? []).map((r) => [r.ref, r.text])), [report]);
  const counts = report ? countByStatus(report.findings) : null;
  const findings = report
    ? STATUS_ORDER.flatMap((s) => report.findings.filter((f) => f.status === s)).filter((f) => filter === "all" || f.status === filter)
    : [];

  async function download() {
    setDownloading(true);
    try {
      await onDownload(identification);
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, current: Tab) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.indexOf(current);
    const next =
      event.key === "Home" ? TABS[0]
      : event.key === "End" ? TABS[TABS.length - 1]
      : TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`report-tab-${next}`)?.focus());
  }

  const toggle = (ref: string) => setOpen((current) => (current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref]));

  return (
    <section className={`report-pane ${collapsed ? "collapsed" : ""} ${mobileActive ? "mobile-active" : ""}`} aria-labelledby="report-title">
      <button className="collapse-tab" aria-label="Expandir relatório" onClick={() => onCollapse(false)}>
        <ChevronLeft size={18} />
        <span>Relatório</span>
      </button>

      <header className="report-header">
        <div className="report-heading">
          <span className="report-icon">
            <FileCheck2 size={18} />
          </span>
          <div>
            <h2 id="report-title">Relatório de conformidade</h2>
            <p>{state.activity || "Aguardando a descrição da atividade."}</p>
            {report && (
              <small>
                Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")} · normas capturadas em{" "}
                {new Date(`${report.corpus_date}T12:00:00`).toLocaleDateString("pt-BR")}
              </small>
            )}
          </div>
        </div>
        <div className="report-actions">
          {report && (
            <>
              <button className="primary-button" onClick={download} disabled={downloading}>
                <Download size={15} />
                {downloading ? "Gerando…" : "Baixar PDF"}
              </button>
              <button className="icon-button" aria-label="Nova conferência" title="Nova conferência" onClick={onReset}>
                <Plus size={17} />
              </button>
            </>
          )}
          <button className="panel-collapse-button" aria-label="Recolher relatório" onClick={() => onCollapse(true)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </header>

      <div className="report-tabs" role="tablist" aria-label="Seções do relatório">
        {TABS.map((t) => (
          <button
            key={t}
            id={`report-tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`report-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            onKeyDown={(event) => onTabKey(event, t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="report-scroll" id={`report-panel-${tab}`} role="tabpanel" aria-labelledby={`report-tab-${tab}`}>
        {tab === "overview" &&
          (report && counts ? (
            <>
              <div className="status-grid" aria-label="Resumo por status">
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    className={`status-card tone-${status}`}
                    aria-pressed={filter === status}
                    onClick={() => setFilter(filter === status ? "all" : status)}
                  >
                    <span className="status-symbol">
                      <StatusIcon status={status} />
                    </span>
                    <span>
                      <strong>{counts[status]}</strong>
                      <small>{STATUS_LABEL[status].plural}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="requirements-heading">
                <h3>Requisitos verificados ({findings.length})</h3>
                <label className="status-filter">
                  <span className="sr-only">Filtrar por status</span>
                  <select value={filter} onChange={(event) => setFilter(event.target.value as FindingStatus | "all")}>
                    <option value="all">Todos os status</option>
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABEL[status].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </label>
              </div>
              <div className="requirements-list">
                {findings.map((finding) => {
                  const expanded = open.includes(finding.ref);
                  return (
                    <article className={`requirement tone-${finding.status}`} key={finding.ref}>
                      <button className="requirement-summary" onClick={() => toggle(finding.ref)} aria-expanded={expanded}>
                        <span className="status-symbol">
                          <StatusIcon status={finding.status} />
                        </span>
                        <span className="status-label">{STATUS_LABEL[finding.status].label}</span>
                        <small>{finding.ref}</small>
                        <ChevronDown className={expanded ? "rotated" : ""} size={15} />
                      </button>
                      <p>{finding.justification}</p>
                      {finding.recommendation && (
                        <p className="finding-field">
                          <strong>Recomendação</strong>
                          {finding.recommendation}
                        </p>
                      )}
                      {expanded && finding.evidence && (
                        <p className="finding-field">
                          <strong>Evidência informada</strong>
                          {finding.evidence}
                        </p>
                      )}
                      {expanded && textOf.get(finding.ref) && <p className="norm-text">{textOf.get(finding.ref)}</p>}
                    </article>
                  );
                })}
              </div>
              <details className="doc-fields">
                <summary>Identificação do documento (opcional)</summary>
                <p>Esses dados entram só no PDF. Não são enviados ao modelo de linguagem.</p>
                <div>
                  {([
                    ["company", "Empresa / unidade"],
                    ["location", "Local da atividade"],
                    ["responsible", "Responsável pela atividade"],
                    ["reviewer", "Profissional de SST que vai revisar"],
                  ] as const).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input value={identification[field]} maxLength={200} onChange={(event) => identify(field, event.target.value)} />
                    </label>
                  ))}
                </div>
              </details>
              <p className="report-foot">
                Minuta de relatório técnico: só vale como documento da empresa depois de revisada e assinada por
                profissional habilitado. {report.disclaimer}
              </p>
            </>
          ) : (
            <div className="empty-panel">
              <FileCheck2 size={24} />
              <div>
                <h3>O relatório aparece aqui</h3>
                <p>
                  Depois das respostas, cada requisito recuperado recebe um status (atendido, pendente, não informado ou
                  decisão do profissional) com a justificativa e o item citado. O PDF sai deste painel.
                </p>
              </div>
            </div>
          ))}

        {tab === "norms" &&
          (state.analysis && state.analysis.norms.length > 0 ? (
            <div className="requirements-list">
              {state.analysis.norms.map((norm) => (
                <article className="requirement tone-decisao_humana" key={norm.norm}>
                  <p>
                    <strong>{norm.norm}</strong> · {norm.title}
                  </p>
                  <p className="norm-text">
                    {state.analysis!.requirements.filter((r) => r.norm === norm.norm).length} itens recuperados para esta atividade
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-note">Nenhuma norma identificada ainda.</p>
          ))}

        {tab === "answers" &&
          (state.answers.length > 0 ? (
            <ol className="answers-list">
              {state.answers.map((qa, index) => (
                <li key={index}>
                  <strong>{qa.question}</strong>
                  <p>{qa.answer}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted-note">As respostas da conferência aparecem aqui.</p>
          ))}
      </div>
    </section>
  );
}
