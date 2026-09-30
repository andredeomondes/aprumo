import PDFDocument from "pdfkit";
import type { Finding, Report } from "../schemas.js";

type Status = Finding["status"];

const LABEL: Record<Status, string> = {
  pendente: "Pendente",
  decisao_humana: "Decisão do profissional",
  nao_informado: "Não informado",
  atendido: "Atendido",
};

const COLOR: Record<Status, string> = {
  pendente: "#b42318",
  decisao_humana: "#b54708",
  nao_informado: "#475467",
  atendido: "#067647",
};

// Pendências primeiro: é o que o profissional precisa resolver antes de liberar a atividade.
const ORDER: Status[] = ["pendente", "decisao_humana", "nao_informado", "atendido"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}

/** Relatório de conformidade. As fontes padrão do PDFKit (WinAnsi) cobrem os acentos do português. */
export function renderReportPdf(report: Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: "Aprumo — Relatório de conformidade normativa" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const textOf = new Map(report.requirements.map((r) => [r.ref, r.text]));
    const section = (title: string) => doc.moveDown(1).fillColor("#101828").font("Helvetica-Bold").fontSize(12).text(title);

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#101828").text("Aprumo");
    doc.font("Helvetica").fontSize(12).text("Relatório de conformidade normativa");
    doc.moveDown(0.3).fontSize(9).fillColor("#475467")
      .text(`Gerado em ${formatDate(report.generated_at)} · corpus normativo capturado em ${report.corpus_date}`);

    section("Atividade");
    doc.font("Helvetica").fontSize(10).fillColor("#101828").text(report.activity);

    section("Normas aplicáveis");
    for (const norm of report.norms) doc.font("Helvetica").fontSize(10).text(`• ${norm.norm} — ${norm.title}`);

    section("Resumo");
    const counts = ORDER.map((s) => `${LABEL[s]}: ${report.findings.filter((f) => f.status === s).length}`);
    doc.font("Helvetica").fontSize(10).text(counts.join("     "));

    section("Requisitos verificados");
    for (const status of ORDER) {
      for (const finding of report.findings.filter((f) => f.status === status)) {
        doc.moveDown(0.6).font("Helvetica-Bold").fontSize(10).fillColor(COLOR[status])
          .text(`${LABEL[status]} · ${finding.ref}`);
        const requirement = textOf.get(finding.ref);
        if (requirement) doc.font("Helvetica-Oblique").fontSize(9).fillColor("#475467").text(requirement);
        doc.font("Helvetica").fontSize(10).fillColor("#101828").text(finding.justification);
      }
    }

    doc.moveDown(2).font("Helvetica").fontSize(8).fillColor("#475467").text(report.disclaimer, { align: "center" });
    doc.end();
  });
}
