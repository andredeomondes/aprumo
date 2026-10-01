import { Activity, BookOpen, FileCheck2, History, MessageSquare, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { usePage } from "./app/usePage";
import { BrandMark } from "./components/BrandMark";
import { ContextRail } from "./components/ContextRail";
import { ConversationPane } from "./components/ConversationPane";
import { Dashboard } from "./components/Dashboard";
import { HistoryPage } from "./components/HistoryPage";
import { NormsCatalog } from "./components/NormsCatalog";
import { ReportPane } from "./components/ReportPane";
import { TransientNotice } from "./components/TransientNotice";
import { useTransientNotice } from "./hooks/useTransientNotice";
import { useAssessment } from "./state/useAssessment";
import { useSuggestionData } from "./useSuggestionData";

type MobileView = "conversation" | "context" | "report";

export default function App() {
  const page = usePage();
  const data = useSuggestionData();
  const [mobileView, setMobileView] = useState<MobileView>("conversation");
  const showReport = useCallback(() => setMobileView("report"), []);
  const { state, busy, slow, send, retry, finish, downloadPdf, reset } = useAssessment({ onReportReady: showReport });
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [reportCollapsed, setReportCollapsed] = useState(false);
  const { notice, show: showNotice, dismiss: dismissNotice } = useTransientNotice();
  const showError = useCallback((text: string) => showNotice(text, "error"), [showNotice]);

  function startNew() {
    reset();
    setMobileView("conversation");
    window.location.hash = "";
  }

  const nav = [
    { page: "conferencia", label: "Conferência", icon: MessageSquare, href: "#" },
    { page: "historico", label: "Histórico", icon: History, href: "#historico" },
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
          <a className="icon-button" href="#historico" aria-label="Histórico">
            <History size={16} />
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
      {page === "historico" && <HistoryPage onError={showError} />}
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
            onFinish={finish}
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

      <TransientNotice notice={notice} onDismiss={dismissNotice} />
    </div>
  );
}
