import { Save, X } from "lucide-react";
import { useState } from "react";
import { STATUS_LABEL, STATUS_ORDER } from "../status";
import type { CreateHistoryRevision, FindingStatus, HistoryRecord } from "../types";

interface Props {
  record: HistoryRecord;
  saving: boolean;
  onCancel: () => void;
  onSave: (revision: CreateHistoryRevision) => Promise<void>;
}

export function HistoryRecordEditor({ record, saving, onCancel, onSave }: Props) {
  const [activity, setActivity] = useState(record.report.activity);
  const [changeNote, setChangeNote] = useState("");
  const [findings, setFindings] = useState(record.report.findings);
  const [answers, setAnswers] = useState(record.report.answers);
  const valid = activity.trim().length >= 10 && changeNote.trim().length >= 3;

  return (
    <form className="history-editor" onSubmit={(event) => {
      event.preventDefault();
      if (valid) void onSave({ activity, change_note: changeNote, findings, answers });
    }}>
      <header className="history-editor-head">
        <div>
          <h2>Criar nova versão</h2>
          <p>A versão {record.version} permanecerá disponível sem alterações.</p>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Cancelar edição"><X size={16} /></button>
      </header>

      <div className="history-editor-fields">
        <label>
          <span>Atividade</span>
          <textarea value={activity} onChange={(event) => setActivity(event.target.value)} maxLength={2000} />
        </label>
        <label>
          <span>Motivo da alteração</span>
          <input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Ex.: evidências conferidas em campo" maxLength={500} />
        </label>
      </div>

      <section className="history-editor-section">
        <h3>Classificações e justificativas</h3>
        <div className="history-editor-findings">
          {findings.map((finding, index) => (
            <div key={finding.ref}>
              <strong>{finding.ref}</strong>
              <select
                aria-label={`Status de ${finding.ref}`}
                value={finding.status}
                onChange={(event) => setFindings((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, status: event.target.value as FindingStatus } : item,
                ))}
              >
                {STATUS_ORDER.map((status) => <option value={status} key={status}>{STATUS_LABEL[status].label}</option>)}
              </select>
              <textarea
                aria-label={`Justificativa de ${finding.ref}`}
                value={finding.justification}
                onChange={(event) => setFindings((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, justification: event.target.value } : item,
                ))}
                maxLength={2000}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="history-editor-section">
        <h3>Respostas registradas</h3>
        <div className="history-editor-answers">
          {answers.map((answer, index) => (
            <label key={`${answer.question}-${index}`}>
              <span>{answer.question}</span>
              <textarea
                value={answer.answer}
                onChange={(event) => setAnswers((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, answer: event.target.value } : item,
                ))}
                maxLength={2000}
              />
            </label>
          ))}
        </div>
      </section>

      <footer className="history-editor-actions">
        <p>Ao salvar, o Aprumo cria a versão {record.version + 1} e preserva esta versão.</p>
        <div>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={!valid || saving}>
            <Save size={14} /> {saving ? "Salvando…" : "Salvar nova versão"}
          </button>
        </div>
      </footer>
    </form>
  );
}
