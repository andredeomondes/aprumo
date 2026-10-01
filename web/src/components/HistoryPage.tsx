import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  History,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AprumoGateway } from "../api";
import { STATUS_LABEL, STATUS_ORDER } from "../status";
import type { CreateFeedback, FeedbackVerdict, FindingStatus, HistoryRecord, HistorySummary } from "../types";
import type { CreateHistoryRevision } from "../types";
import { HistoryRecordEditor } from "./HistoryRecordEditor";

const VERDICT_LABEL: Record<FeedbackVerdict, string> = {
  correto: "Correto",
  incorreto: "Incorreto",
  incompleto: "Incompleto",
  pouco_relevante: "Pouco relevante",
  pergunta_confusa: "Pergunta confusa",
  faltou_pergunta: "Faltou pergunta",
};

function StatusIcon({ status }: { status: FindingStatus }) {
  if (status === "atendido") return <Check size={14} strokeWidth={3} />;
  if (status === "pendente") return <AlertTriangle size={14} />;
  return <CircleHelp size={14} />;
}

interface Props {
  gateway?: AprumoGateway;
  onError: (message: string) => void;
}

export function HistoryPage({ gateway = api, onError }: Props) {
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [record, setRecord] = useState<HistoryRecord>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<string>();
  const [verdict, setVerdict] = useState<FeedbackVerdict>("incompleto");
  const [comment, setComment] = useState("");
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>();

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const history = await gateway.history(scope === "archived");
      setItems(history);
      setLoadingDetail(history.length > 0);
      setSelectedId((current) => history.some((item) => item.id === current) ? current : history[0]?.id);
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [gateway, onError, scope]);

  useEffect(() => {
    queueMicrotask(() => void loadList());
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    gateway.historyEntry(selectedId)
      .then(setRecord)
      .catch((error: Error) => onError(error.message))
      .finally(() => setLoadingDetail(false));
  }, [gateway, onError, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return items;
    return items.filter((item) =>
      item.activity.toLocaleLowerCase("pt-BR").includes(normalized)
      || item.norm_codes.some((norm) => norm.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [items, query]);

  async function submitFeedback(targetRef: string) {
    if (!record) return;
    const payload: CreateFeedback = {
      target_type: "requisito",
      target_ref: targetRef,
      verdict,
      comment,
      correction,
    };
    setSaving(true);
    try {
      const created = await gateway.sendFeedback(record.id, payload);
      setRecord({ ...record, updated_at: created.created_at, feedback: [...record.feedback, created] });
      setItems((current) => current.map((item) => item.id === record.id
        ? { ...item, updated_at: created.created_at, feedback_count: item.feedback_count + 1 }
        : item));
      setFeedbackTarget(undefined);
      setComment("");
      setCorrection("");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveCurrent(archived: boolean) {
    if (!record) return;
    setSaving(true);
    try {
      await gateway.archiveHistory(record.id, archived);
      setRecord(undefined);
      setSelectedId(undefined);
      setEditing(false);
      await loadList();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveRevision(revision: CreateHistoryRevision) {
    if (!record) return;
    setSaving(true);
    try {
      const created = await gateway.reviseHistory(record.id, revision);
      setScope("active");
      setRecord(created);
      setSelectedId(created.id);
      setEditing(false);
      setDeleteConfirmation(undefined);
      setItems(await gateway.history(false));
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!record || deleteConfirmation !== "EXCLUIR") return;
    setSaving(true);
    try {
      await gateway.deleteHistory(record.id, "EXCLUIR");
      setRecord(undefined);
      setSelectedId(undefined);
      setDeleteConfirmation(undefined);
      await loadList();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="main-content" className="history-page">
      <header className="history-page-header">
        <div>
          <h1>Histórico de conferências</h1>
          <p>Reabra análises, compare versões e registre a revisão técnica sem alterar automaticamente o relatório original.</p>
        </div>
        <button className="secondary-button" onClick={() => void loadList()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Atualizar
        </button>
      </header>

      <div className="history-layout">
        <section className="history-index" aria-label="Conferências salvas">
          <div className="history-scope" role="group" aria-label="Tipo de histórico">
            <button
              className={scope === "active" ? "active" : ""}
              aria-pressed={scope === "active"}
              onClick={() => { setScope("active"); setRecord(undefined); setSelectedId(undefined); }}
            >Ativos</button>
            <button
              className={scope === "archived" ? "active" : ""}
              aria-pressed={scope === "archived"}
              onClick={() => { setScope("archived"); setRecord(undefined); setSelectedId(undefined); }}
            >Arquivados</button>
          </div>
          <label className="history-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Buscar no histórico</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atividade ou NR" />
          </label>

          {loading ? (
            <div className="history-skeleton" aria-label="Carregando histórico"><i /><i /><i /></div>
          ) : filtered.length === 0 ? (
            <div className="history-empty">
              <History size={22} />
              <h2>{items.length ? "Nenhum resultado" : scope === "archived" ? "Nenhuma conferência arquivada" : "O histórico começa na próxima conferência"}</h2>
              <p>{items.length ? "Tente outro termo de busca." : scope === "archived" ? "Itens arquivados aparecem aqui e podem ser restaurados." : "Relatórios concluídos são salvos automaticamente e aparecem aqui."}</p>
            </div>
          ) : (
            <div className="history-list">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className={item.id === selectedId ? "selected" : ""}
                  aria-pressed={item.id === selectedId}
                  onClick={() => {
                    setLoadingDetail(true);
                    setSelectedId(item.id);
                  }}
                >
                  <span className="history-list-copy">
                    <strong>{item.activity}</strong>
                    <small>{new Date(item.created_at).toLocaleString("pt-BR")} · versão {item.version}</small>
                    <span className="history-tags">
                      {item.norm_codes.slice(0, 4).map((norm) => <span key={norm}>{norm}</span>)}
                      {item.feedback_count > 0 && <span><MessageSquareText size={11} /> {item.feedback_count}</span>}
                    </span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="history-detail" aria-live="polite">
          {loadingDetail ? (
            <div className="history-detail-loading"><RefreshCw size={20} className="spin" /> Carregando conferência…</div>
          ) : record && editing ? (
            <HistoryRecordEditor key={record.id} record={record} saving={saving} onCancel={() => setEditing(false)} onSave={saveRevision} />
          ) : record ? (
            <>
              <header className="history-detail-header">
                <div>
                  <span className="history-version"><History size={13} /> Versão {record.version}</span>
                  <h2>{record.report.activity}</h2>
                  <p>Gerado em {new Date(record.report.generated_at).toLocaleString("pt-BR")} · base normativa de {new Date(`${record.report.corpus_date}T12:00:00`).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="history-record-actions">
                  <span className="saved-state"><CheckCircle2 size={15} /> {record.archived_at ? "Arquivado" : "Salvo"}</span>
                  {!record.archived_at && (
                    <>
                      <button className="secondary-button" onClick={() => setEditing(true)}><Pencil size={14} /> Nova versão</button>
                      <button className="secondary-button" onClick={() => void archiveCurrent(true)} disabled={saving}><Archive size={14} /> Arquivar</button>
                    </>
                  )}
                  {record.archived_at && (
                    <>
                      <button className="secondary-button" onClick={() => void archiveCurrent(false)} disabled={saving}><ArchiveRestore size={14} /> Restaurar</button>
                      <button className="danger-button" onClick={() => setDeleteConfirmation("")}><Trash2 size={14} /> Excluir</button>
                    </>
                  )}
                </div>
              </header>

              {record.revision_of && (
                <p className="history-change-note"><History size={13} /> Revisão da versão anterior: {record.change_note}</p>
              )}

              {deleteConfirmation !== undefined && (
                <section className="delete-confirmation" aria-labelledby="delete-title">
                  <div>
                    <h3 id="delete-title">Excluir definitivamente esta conferência?</h3>
                    <p>Esta ação remove o relatório, respostas e feedbacks. Digite <strong>EXCLUIR</strong> para confirmar.</p>
                  </div>
                  <input aria-label="Confirmação de exclusão" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoFocus />
                  <button className="secondary-button" onClick={() => setDeleteConfirmation(undefined)}>Cancelar</button>
                  <button className="danger-button" disabled={deleteConfirmation !== "EXCLUIR" || saving} onClick={() => void deleteCurrent()}>
                    <Trash2 size={14} /> {saving ? "Excluindo…" : "Excluir definitivamente"}
                  </button>
                </section>
              )}

              <div className="history-status-strip" aria-label="Resumo da conferência">
                {STATUS_ORDER.map((status) => (
                  <div className={`tone-${status}`} key={status}>
                    <span className="status-symbol"><StatusIcon status={status} /></span>
                    <strong>{record.report.findings.filter((finding) => finding.status === status).length}</strong>
                    <small>{STATUS_LABEL[status].plural}</small>
                  </div>
                ))}
              </div>

              <div className="history-findings-heading">
                <div>
                  <h3>Revisão técnica</h3>
                  <p>Marque o que precisa ser validado ou melhorado. O registro fica pendente para revisão humana.</p>
                </div>
                <span><MessageSquareText size={14} /> {record.feedback.length} apontamentos</span>
              </div>

              <div className="history-findings">
                {record.report.findings.map((finding) => {
                  const feedback = record.feedback.filter((item) => item.target_ref === finding.ref);
                  const editing = feedbackTarget === finding.ref;
                  return (
                    <article key={finding.ref} className={`history-finding tone-${finding.status}`}>
                      <div className="history-finding-main">
                        <span className="status-symbol"><StatusIcon status={finding.status} /></span>
                        <div>
                          <div className="history-finding-title">
                            <strong>{STATUS_LABEL[finding.status].label}</strong>
                            <span>{finding.ref}</span>
                          </div>
                          <p>{finding.justification}</p>
                        </div>
                        <button
                          className="feedback-toggle"
                          aria-expanded={editing}
                          onClick={() => setFeedbackTarget(editing ? undefined : finding.ref)}
                        >
                          <MessageSquareText size={14} /> {editing ? "Fechar" : "Revisar"}
                        </button>
                      </div>

                      {feedback.length > 0 && (
                        <div className="feedback-history">
                          {feedback.map((item) => (
                            <p key={item.id}>
                              <span>{VERDICT_LABEL[item.verdict]}</span>
                              {item.comment || item.correction || "Sem observação adicional."}
                              <small>{item.reviewed ? "Revisado" : "Aguardando revisão"}</small>
                            </p>
                          ))}
                        </div>
                      )}

                      {editing && (
                        <div className="feedback-form">
                          <label>
                            <span>Classificação</span>
                            <select value={verdict} onChange={(event) => setVerdict(event.target.value as FeedbackVerdict)}>
                              {(Object.keys(VERDICT_LABEL) as FeedbackVerdict[]).map((value) => (
                                <option value={value} key={value}>{VERDICT_LABEL[value]}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Observação técnica</span>
                            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explique o motivo para quem fará a revisão." maxLength={2000} />
                          </label>
                          <label>
                            <span>Correção sugerida <small>(opcional)</small></span>
                            <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="Indique a redação, evidência ou enquadramento esperado." maxLength={2000} />
                          </label>
                          <div className="feedback-actions">
                            <p><ClipboardCheck size={14} /> A sugestão não modifica a análise até ser revisada.</p>
                            <button className="primary-button" onClick={() => void submitFeedback(finding.ref)} disabled={saving}>
                              <Send size={14} /> {saving ? "Registrando…" : "Registrar feedback"}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="history-empty history-empty-detail">
              <ClipboardCheck size={26} />
              <h2>Selecione uma conferência</h2>
              <p>Os requisitos, respostas e apontamentos técnicos aparecem aqui.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
