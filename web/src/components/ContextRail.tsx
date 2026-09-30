import { CheckCircle2, ChevronLeft, ChevronRight, Circle, HardHat } from "lucide-react";
import type { State } from "../state/assessment";
import { relevance } from "../status";
import { TrendCard } from "./TrendCard";

interface Props {
  state: State;
  collapsed: boolean;
  mobileActive: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export function ContextRail({ state, collapsed, mobileActive, onCollapse }: Props) {
  const analysis = state.analysis;
  const questions = analysis?.questions ?? [];
  const answered = state.answers.length;
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  return (
    <aside
      className={`context-rail ${collapsed ? "collapsed" : ""} ${mobileActive ? "mobile-active" : ""}`}
      aria-labelledby="context-title"
    >
      <button className="collapse-tab" aria-label="Expandir andamento" onClick={() => onCollapse(false)}>
        <ChevronLeft size={18} />
        <span>Andamento</span>
      </button>

      <section className="context-head">
        <div className="context-title-row">
          <h2 id="context-title">Andamento</h2>
          <button className="panel-collapse-button" aria-label="Recolher andamento" onClick={() => onCollapse(true)}>
            <ChevronRight size={17} />
          </button>
        </div>
        <p>{state.activity || "Nenhuma atividade descrita ainda."}</p>
        <div className="progress-copy">
          <span>
            {answered} de {questions.length} perguntas respondidas
          </span>
          <strong>{progress}%</strong>
        </div>
        <div
          className="progress-bar"
          role="progressbar"
          aria-label="Progresso da conferência"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>Normas identificadas</h3>
        </div>
        {analysis && analysis.norms.length > 0 ? (
          <div className="norm-list">
            {analysis.norms.map((norm) => {
              const level = relevance(norm.share);
              return (
                <article className={`norm-card tone-${level === "Alta" ? "alta" : level === "Média" ? "media" : "baixa"}`} key={norm.norm}>
                  <span className="norm-icon">
                    <HardHat size={14} />
                  </span>
                  <div>
                    <strong>{norm.norm}</strong>
                    <p>{norm.title}</p>
                  </div>
                  <small>
                    Relevância
                    <strong>{level}</strong>
                  </small>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted-note">As normas aparecem aqui depois que a atividade for analisada.</p>
        )}
      </section>

      {analysis && analysis.risk_context.length > 0 && (
        <section>
          <div className="section-title">
            <h3>Acidentes no setor</h3>
          </div>
          <div className="norm-list">
            {analysis.risk_context.map((trend) => (
              <TrendCard key={trend.norm} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className="conference-progress">
          <h3>Perguntas</h3>
          {questions.map((question, index) => {
            const done = index < answered;
            const current = state.phase === "asking" && index === state.questionIndex;
            return (
              <div className={`step ${done ? "done" : ""} ${current ? "current" : ""}`} key={question.id}>
                <span>{index + 1}</span>
                <p>{question.text}</p>
                <small>
                  {done ? <CheckCircle2 size={13} /> : <Circle size={12} />}
                  {done ? "Respondida" : current ? "Agora" : "Pendente"}
                </small>
              </div>
            );
          })}
        </section>
      )}
    </aside>
  );
}
