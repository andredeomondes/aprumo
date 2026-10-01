import { Bot, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { Notice } from "../hooks/useTransientNotice";

interface Props {
  notice: Notice | null;
  onDismiss: () => void;
}

export function TransientNotice({ notice, onDismiss }: Props) {
  if (!notice) return null;

  const style = { "--toast-duration": `${notice.durationMs}ms` } as CSSProperties;

  return (
    <div
      key={notice.id}
      className={`toast ${notice.tone === "error" ? "error" : ""}`}
      role={notice.tone === "error" ? "alert" : "status"}
      style={style}
    >
      <Bot size={16} />
      <span>{notice.text}</span>
      <button type="button" aria-label="Fechar aviso" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
