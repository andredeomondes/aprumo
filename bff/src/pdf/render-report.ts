import PDFDocument from "pdfkit";
import type { Finding, Report, SectorTrend } from "../schemas.js";

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

const number = new Intl.NumberFormat("pt-BR");

function monthLabel(yyyymm: string): string {
  return `${yyyymm.slice(4, 6)}/${yyyymm.slice(0, 4)}`;
}

/** Barras dos últimos meses desenhadas direto no PDF, sem biblioteca de gráfico. */
function drawBars(doc: PDFKit.PDFDocument, values: number[], x: number, y: number, width: number, height: number) {
  const max = Math.max(...values, 1);
  const gap = 2;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  values.forEach((value, index) => {
    const barHeight = Math.max(1, (value / max) * height);
    doc.rect(x + index * (barWidth + gap), y + height - barHeight, barWidth, barHeight).fill("#5c6663");
  });
  doc.fillColor("#101828");
}

function drawTrend(doc: PDFKit.PDFDocument, trend: SectorTrend) {
  const direction = trend.change_pct >= 0 ? "alta" : "queda";
  doc.moveDown(0.6).font("Helvetica-Bold").fontSize(10).fillColor("#101828").text(`${trend.norm} · ${trend.sector}`);
  doc.font("Helvetica").fontSize(9).fillColor("#475467").text(
    `${number.format(trend.last_12m)} acidentes típicos nos últimos 12 meses ` +
      `(${direction} de ${Math.abs(trend.change_pct).toFixed(1).replace(".", ",")}% sobre os 12 anteriores), ` +
      `${number.format(trend.deaths_12m)} com óbito.`,
  );
  const top = doc.y + 4;
  drawBars(doc, trend.values, doc.page.margins.left, top, 260, 36);
  doc.y = top + 40;
  doc.fontSize(8).fillColor("#475467").text(
    `${monthLabel(trend.months[0])} a ${monthLabel(trend.months[trend.months.length - 1])}` +
      (trend.forecast_beats_naive
        ? ` · projeção para os próximos 3 meses: ${trend.forecast.map((v) => number.format(v)).join(", ")}`
        : " · sem projeção: o modelo não superou o ingênuo no teste"),
  );
}

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

    if (report.risk_context.length > 0) {
      section("Contexto de acidentes no setor");
      doc.font("Helvetica").fontSize(8).fillColor("#475467")
        .text("Fonte: INSS, Comunicações de Acidente de Trabalho (dados abertos, CC-BY). Mês de processamento da CAT.");
      report.risk_context.forEach((trend) => drawTrend(doc, trend));
    }

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
