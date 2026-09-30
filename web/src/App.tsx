import { Activity, BookOpen, Bot, FileCheck2, MessageSquare, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { ContextRail } from "./components/ContextRail";
import { ConversationPane } from "./components/ConversationPane";
import { Dashboard } from "./components/Dashboard";
import { NormsCatalog } from "./components/NormsCatalog";
import { ReportPane } from "./components/ReportPane";
import { useAssessment } from "./state/useAssessment";
import { useSuggestionData } from "./useSuggestionData";

type Page = "conferencia" | "normas" | "painel";
type MobileView = "conversation" | "context" | "report";

function usePage(): Page {
  const read = (): Page => {
    const hash = window.location.hash.replace("#", "");
    return hash === "normas" || hash === "painel" ? hash : "conferencia";
  };
  const [page, setPage] = useState<Page>(read);
  useEffect(() => {
    const update = () => setPage(read());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return page;
}

export default function App() {
  const page = usePage();
  const data = useSuggestionData();
  const { state, busy, slow, send, retry, downloadPdf, reset } = useAssessment();
  const [mobileView, setMobileView] = useState<MobileView>("conversation");
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [reportCollapsed, setReportCollapsed] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const showError = useCallback((text: string) => setNotice({ text, error: true }), []);

  // Relatório pronto: no celular, leva a pessoa direto para ele.
  useEffect(() => {
    if (state.phase === "done") setMobileView("report");
  }, [state.phase]);

  function startNew() {
    reset();
    setMobileView("conversation");
    window.location.hash = "";
  }

  const nav = [
    { page: "conferencia", label: "Conferência", icon: MessageSquare, href: "#" },
    { page: "normas", label: "Normas (NRs)", icon: BookOpen, href: "#normas" },
    { page: "painel", label: "Painel", icon: Activity, href: "#painel" },
  ] as const;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>

      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-lockup">
          <BrandMark />
          <strong>Aprumo</strong>
        </div>
        <button className="new-conference" onClick={startNew}>
          <Plus size={16} />
          <span>Nova conferência</span>
        </button>
        <nav>
          {nav.map((item) => (
            <a key={item.page} href={item.href} aria-current={page === item.page ? "page" : undefined}>
              <item.icon size={17} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <p className="sidebar-foot">
          Apoio à conferência de requisitos das NRs. Não substitui profissional habilitado nem a leitura da norma.
        </p>
      </aside>

      <header className="mobile-header">
        <div className="brand-lockup">
          <BrandMark compact />
          <strong>Aprumo</strong>
        </div>
        {page === "conferencia" ? (
          <div className="mobile-switch" role="group" aria-label="Alternar área">
            {(["conversation", "context", "report"] as MobileView[]).map((view) => (
              <button
                key={view}
                aria-pressed={mobileView === view}
                className={mobileView === view ? "active" : ""}
                onClick={() => setMobileView(view)}
              >
                {view === "conversation" ? "Conversa" : view === "context" ? "Andamento" : "Relatório"}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <nav className="mobile-menu" aria-label="Seções">
          <a className="icon-button" href="#" aria-label="Conferência">
            <FileCheck2 size={16} />
          </a>
          <a className="icon-button" href="#normas" aria-label="Normas">
            <BookOpen size={16} />
          </a>
          <a className="icon-button" href="#painel" aria-label="Painel">
            <Activity size={16} />
          </a>
        </nav>
      </header>

      {page === "normas" && (
        <main id="main-content">
          <NormsCatalog norms={data.norms ?? []} />
        </main>
      )}
      {page === "painel" && (
        <main id="main-content">
          <Dashboard onError={showError} />
        </main>
      )}
      {page === "conferencia" && (
        <main
          id="main-content"
          className={`workspace ${contextCollapsed ? "context-collapsed" : ""} ${reportCollapsed ? "report-collapsed" : ""}`}
        >
          <ConversationPane
            state={state}
            busy={busy}
            slow={slow}
            data={data}
            mobileActive={mobileView === "conversation"}
            onSend={send}
            onRetry={retry}
            onReset={startNew}
          />
          <ContextRail
            state={state}
            collapsed={contextCollapsed}
            mobileActive={mobileView === "context"}
            onCollapse={setContextCollapsed}
          />
          <ReportPane
            state={state}
            collapsed={reportCollapsed}
            mobileActive={mobileView === "report"}
            onCollapse={setReportCollapsed}
            onDownload={downloadPdf}
            onReset={startNew}
            onError={showError}
          />
        </main>
      )}

      {notice && (
        <div className={`toast ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>
          <Bot size={16} />
          <span>{notice.text}</span>
          <button aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
