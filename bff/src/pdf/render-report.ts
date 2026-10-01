import PDFDocument from "pdfkit";
import type { Finding, Report, SectorTrend } from "../schemas.js";
import { APRUMO_LOGO } from "./logo.js";
import { DEFAULT_ACTION, STATUS_LABEL, STATUS_ORDER, actionPlan, conclusion, countByStatus, reportNumber } from "./report-text.js";

type Status = Finding["status"];
type Doc = PDFKit.PDFDocument;
// `openImage` existe no PDFKit, mas não está nos tipos publicados.
type Logo = Parameters<Doc["image"]>[0];
type WithOpenImage = { openImage(source: Buffer): Logo };

const PAGE = { left: 46, right: 549, width: 503, top: 70, bottom: 770 };
const PALETTE = {
  ink: "#0B1724", muted: "#5D6B7C", line: "#D8E1EB", paper: "#FFFFFF", soft: "#F5F8FB",
  navy: "#071827", blue: "#2F6BF6", cyan: "#34C7F3",
  green: "#087A55", greenSoft: "#EAF8F2", amber: "#A85A00", amberSoft: "#FFF5DE",
  red: "#B42318", redSoft: "#FFF0EF", slate: "#475467", slateSoft: "#F1F4F8",
};
const COLOR: Record<Status, string> = { pendente: PALETTE.red, decisao_humana: PALETTE.amber, nao_informado: PALETTE.slate, atendido: PALETTE.green };
const SOFT: Record<Status, string> = { pendente: PALETTE.redSoft, decisao_humana: PALETTE.amberSoft, nao_informado: PALETTE.slateSoft, atendido: PALETTE.greenSoft };

const number = new Intl.NumberFormat("pt-BR");
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
const formatDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" });
const monthLabel = (yyyymm: string) => `${yyyymm.slice(4, 6)}/${yyyymm.slice(0, 4)}`;
const orBlank = (value: string | undefined) => value?.trim() || "Não informado";

function runningHeader(doc: Doc, code: string, logo: Logo): void {
  doc.save();
  doc.rect(0, 0, doc.page.width, 46).fill(PALETTE.navy);
  doc.image(logo, 40, 9, { fit: [28, 28] });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PALETTE.paper).text("APRUMO", 76, 17, { lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor("#BFD0E4").text(`Relatório técnico ${code}`, 300, 18, { width: 249, align: "right", lineBreak: false });
  doc.restore();
  // O PDFKit não devolve fonte e cor ao texto que continua depois da quebra de página.
  doc.font("Helvetica").fontSize(9.5).fillColor(PALETTE.ink);
  doc.x = PAGE.left;
  doc.y = PAGE.top;
}

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > PAGE.bottom) doc.addPage();
}

function heading(doc: Doc, index: string, title: string): void {
  ensureSpace(doc, 70);
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(PALETTE.ink).text(`${index}  ${title}`, PAGE.left, doc.y, { width: PAGE.width });
  doc.strokeColor(PALETTE.blue).lineWidth(1.2).moveTo(PAGE.left, doc.y + 3).lineTo(PAGE.left + 36, doc.y + 3).stroke();
  doc.moveDown(0.7);
}

function paragraph(doc: Doc, text: string): void {
  doc.font("Helvetica").fontSize(10).fillColor(PALETTE.ink).text(text, PAGE.left, doc.y, { width: PAGE.width, lineGap: 3, align: "justify" });
  doc.moveDown(0.5);
}

function bullets(doc: Doc, items: string[]): void {
  for (const item of items) {
    ensureSpace(doc, 30);
    const y = doc.y;
    doc.circle(PAGE.left + 4, y + 5, 1.8).fill(PALETTE.blue);
    doc.font("Helvetica").fontSize(10).fillColor(PALETTE.ink).text(item, PAGE.left + 14, y, { width: PAGE.width - 14, lineGap: 3 });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.3);
}

/** Tabela simples: mede a altura de cada linha pelo maior texto e quebra a página sem cortar linha. */
function table(doc: Doc, widths: number[], header: string[], rows: string[][]): void {
  const padding = 6;
  const draw = (cells: string[], bold: boolean, fill?: string) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8 : 9);
    const height = Math.max(...cells.map((cell, i) => doc.heightOfString(cell || " ", { width: widths[i] - padding * 2, lineGap: 2 }))) + padding * 2;
    ensureSpace(doc, height);
    const y = doc.y;
    let x = PAGE.left;
    if (fill) doc.rect(PAGE.left, y, PAGE.width, height).fill(fill);
    cells.forEach((cell, i) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8 : 9).fillColor(bold ? PALETTE.muted : PALETTE.ink)
        .text(cell || " ", x + padding, y + padding, { width: widths[i] - padding * 2, lineGap: 2 });
      x += widths[i];
    });
    doc.strokeColor(PALETTE.line).lineWidth(0.6).moveTo(PAGE.left, y + height).lineTo(PAGE.right, y + height).stroke();
    doc.x = PAGE.left;
    doc.y = y + height;
  };
  draw(header, true, PALETTE.soft);
  rows.forEach((row) => draw(row, false));
  doc.moveDown(0.8);
}

function drawCover(doc: Doc, report: Report, code: string, logo: Logo): void {
  doc.rect(0, 0, doc.page.width, 206).fill(PALETTE.navy);
  doc.circle(510, 30, 120).fillOpacity(0.12).fill(PALETTE.cyan).fillOpacity(1);
  doc.circle(540, 90, 90).fillOpacity(0.14).fill(PALETTE.blue).fillOpacity(1);
  doc.image(logo, PAGE.left, 24, { fit: [40, 40] });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(PALETTE.paper).text("APRUMO", 94, 36);
  doc.font("Helvetica-Bold").fontSize(21).fillColor(PALETTE.paper)
    .text("Relatório técnico de conferência de requisitos de segurança e saúde no trabalho", PAGE.left, 84, { width: 430, lineGap: 2 });
  doc.font("Helvetica").fontSize(9.5).fillColor("#C8D8E8")
    .text("Minuta para revisão e assinatura do profissional responsável", PAGE.left, doc.y + 8);

  doc.font("Helvetica-Bold").fontSize(8).fillColor(PALETTE.blue).text("IDENTIFICAÇÃO", PAGE.left, 228);
  doc.y = 242;
  const id = report.identification;
  table(doc, [150, 353], ["Campo", "Informação"], [
    ["Relatório nº", code],
    ["Data de emissão", formatDateTime(report.generated_at)],
    ["Empresa / unidade", orBlank(id?.company)],
    ["Local da atividade", orBlank(id?.location)],
    ["Responsável pela atividade", orBlank(id?.responsible)],
    ["Atividade analisada", report.activity],
    ["Normas aplicáveis", report.norms.map((norm) => norm.norm).join(", ") || "Nenhuma identificada"],
    ["Base normativa", `Textos consolidados capturados em ${formatDate(report.corpus_date)}`],
  ]);

  const counts = countByStatus(report);
  const tone: Status = counts.pendente > 0 ? "pendente" : counts.decisao_humana + counts.nao_informado > 0 ? "decisao_humana" : "atendido";
  const title = { pendente: "Há pendências antes da execução", decisao_humana: "A conferência precisa ser concluída", nao_informado: "", atendido: "Nenhuma pendência identificada" }[tone];
  const top = doc.y + 6;
  doc.font("Helvetica").fontSize(9.5);
  const text = conclusion(report);
  const boxHeight = doc.heightOfString(text, { width: 463, lineGap: 2.5 }) + 52;
  doc.roundedRect(PAGE.left, top, PAGE.width, boxHeight, 8).fill(SOFT[tone]);
  doc.rect(PAGE.left, top, 5, boxHeight).fill(COLOR[tone]);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR[tone]).text("PARECER", 66, top + 13);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLOR[tone]).text(title, 66, top + 25);
  doc.font("Helvetica").fontSize(9.5).fillColor(PALETTE.ink).text(text, 66, top + 44, { width: 463, lineGap: 2.5 });

  let x = PAGE.left;
  const pillY = top + boxHeight + 14;
  for (const status of STATUS_ORDER) {
    doc.roundedRect(x, pillY, 119, 26, 6).fill(SOFT[status]);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLOR[status]).text(`${counts[status]}  ${STATUS_LABEL[status]}`, x + 6, pillY + 9, { width: 107, align: "center", lineBreak: false });
    x += 128;
  }
  doc.y = pillY + 40;
}

function labeled(doc: Doc, label: string, text: string, italic = false): void {
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(PALETTE.muted).text(label.toUpperCase(), 62, doc.y, { width: 471 });
  doc.font(italic ? "Helvetica-Oblique" : "Helvetica").fontSize(italic ? 9 : 9.5).fillColor(italic ? PALETTE.slate : PALETTE.ink)
    .text(text, 62, doc.y + 2, { width: 471, lineGap: 2.5, align: "justify" });
  doc.moveDown(0.55);
}

function drawFinding(doc: Doc, index: string, finding: Finding, requirement: string | undefined): void {
  const evidence = (finding.evidence ?? "").trim() || "Nenhuma informação foi registrada sobre este item.";
  const recommendation = (finding.recommendation ?? "").trim() || DEFAULT_ACTION[finding.status];
  // Mede o bloco inteiro antes de desenhar: um requisito não pode ficar cortado entre páginas.
  const fields = [requirement, evidence, finding.justification, recommendation].filter((text): text is string => Boolean(text));
  doc.font("Helvetica").fontSize(9.5);
  const body = fields.reduce((sum, text) => sum + doc.heightOfString(text, { width: 471, lineGap: 2.5 }) + 22, 0);
  ensureSpace(doc, Math.min(body + 44, PAGE.bottom - PAGE.top));
  const top = doc.y;
  doc.rect(PAGE.left, top, PAGE.width, 24).fill(SOFT[finding.status]);
  doc.rect(PAGE.left, top, 4, 24).fill(COLOR[finding.status]);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(PALETTE.ink).text(`${index}  ${finding.ref}`, 58, top + 7.5, { width: 300, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLOR[finding.status]).text(STATUS_LABEL[finding.status], 360, top + 8, { width: 181, align: "right", lineBreak: false });
  doc.y = top + 34;
  if (requirement) labeled(doc, "Requisito normativo", requirement, true);
  labeled(doc, "Evidência informada", evidence);
  labeled(doc, "Análise", finding.justification);
  labeled(doc, "Recomendação", recommendation);
  doc.moveDown(0.5);
}

function drawTrend(doc: Doc, trend: SectorTrend): void {
  ensureSpace(doc, 90);
  const direction = trend.change_pct >= 0 ? "alta" : "queda";
  paragraph(doc,
    `${trend.sector} (${trend.norm}): ${number.format(trend.last_12m)} acidentes típicos nos últimos 12 meses, ${direction} de ` +
    `${Math.abs(trend.change_pct).toFixed(1).replace(".", ",")}% sobre os 12 meses anteriores, dos quais ${number.format(trend.deaths_12m)} com óbito ` +
    `(período de ${monthLabel(trend.months[0])} a ${monthLabel(trend.months[trend.months.length - 1])}).`);
}

function drawSignatures(doc: Doc, report: Report): void {
  ensureSpace(doc, 150);
  doc.moveDown(2.2);
  const y = doc.y + 30;
  const columns: [number, string, string][] = [
    [PAGE.left, "Responsável pela atividade", orBlank(report.identification?.responsible)],
    [PAGE.left + 268, "Profissional de segurança do trabalho", orBlank(report.identification?.reviewer)],
  ];
  for (const [x, role, name] of columns) {
    doc.strokeColor(PALETTE.ink).lineWidth(0.7).moveTo(x, y).lineTo(x + 235, y).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.ink).text(name === "Não informado" ? " " : name, x, y + 6, { width: 235 });
    doc.font("Helvetica").fontSize(8.5).fillColor(PALETTE.muted).text(role, x, y + 19, { width: 235 });
    doc.text("Registro profissional: ____________   Data: ___/___/______", x, y + 32, { width: 235 });
  }
  doc.y = y + 60;
}

function drawFooters(doc: Doc, code: string): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // escrever no rodapé sem que o PDFKit abra uma página nova
    doc.strokeColor(PALETTE.line).lineWidth(0.6).moveTo(PAGE.left, 792).lineTo(PAGE.right, 792).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(PALETTE.muted)
      .text(`${code}  |  Minuta gerada pelo Aprumo. Válida somente após revisão e assinatura do profissional responsável.`, PAGE.left, 799, { width: 420, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PALETTE.muted).text(`Página ${index + 1} de ${range.count}`, 470, 799, { width: 79, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

/** Relatório técnico da conferência: minuta formal para revisão e assinatura do profissional. */
export function renderReportPdf(report: Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const code = reportNumber(report);
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE.top, bottom: 72, left: PAGE.left, right: PAGE.left },
      bufferPages: true,
      info: { Title: `Relatório técnico ${code}`, Subject: report.activity, Author: "Aprumo" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // O logo é aberto uma vez e reaproveitado: embutir de novo em cada página multiplicava o arquivo.
    const logo = (doc as unknown as WithOpenImage).openImage(APRUMO_LOGO);
    drawCover(doc, report, code, logo);
    doc.on("pageAdded", () => runningHeader(doc, code, logo));
    doc.addPage();

    const requirementByRef = new Map(report.requirements.map((requirement) => [requirement.ref, requirement.text]));
    const norms = report.norms.map((norm) => norm.norm);

    heading(doc, "1", "Objetivo");
    paragraph(doc,
      "Este relatório registra a conferência dos requisitos das Normas Regulamentadoras aplicáveis à atividade descrita, " +
      "confrontando as informações prestadas pelo responsável com o que cada item normativo exige. Seu propósito é apoiar o " +
      "planejamento e a liberação da atividade, indicando o que está atendido, o que está pendente e o que depende de decisão técnica.");

    heading(doc, "2", "Escopo e metodologia");
    bullets(doc, [
      `A base normativa consultada reúne os textos consolidados das 36 Normas Regulamentadoras vigentes, capturados em ${formatDate(report.corpus_date)} nas páginas oficiais do Ministério do Trabalho e Emprego.`,
      "As normas aplicáveis foram identificadas a partir da descrição da atividade. Em cada norma, os itens mais relacionados à atividade foram recuperados por busca textual e semântica; cada item numerado é a unidade de análise e de citação.",
      `A conferência foi conduzida por entrevista estruturada, com ${report.answers.length} pergunta(s) derivada(s) dos itens recuperados. As respostas estão transcritas no Anexo A.`,
      "Cada requisito foi classificado como Atendido (há evidência explícita nas respostas), Pendente (a resposta indica que o requisito não é cumprido), Não informado (não houve informação suficiente) ou Decisão do profissional (depende de julgamento técnico).",
      "A análise considera exclusivamente as informações declaradas. Não houve inspeção em campo nem verificação documental; dados pessoais informados foram anonimizados antes do processamento.",
    ]);

    heading(doc, "3", "Descrição da atividade");
    paragraph(doc, report.activity);

    heading(doc, "4", "Base normativa aplicável");
    table(doc, [70, 333, 100], ["Norma", "Título", "Itens analisados"], report.norms.map((norm) => [
      norm.norm, norm.title, String(report.requirements.filter((requirement) => requirement.norm === norm.norm).length),
    ]));

    heading(doc, "5", "Análise dos requisitos");
    if (report.findings.length === 0) paragraph(doc, "Nenhum requisito foi verificado nesta conferência.");
    let position = 0;
    for (const norm of norms.length > 0 ? norms : [""]) {
      const ofNorm = STATUS_ORDER.flatMap((status) => report.findings.filter((finding) => finding.status === status))
        .filter((finding) => norm === "" || finding.ref.startsWith(`${norm} `));
      for (const finding of ofNorm) {
        position += 1;
        drawFinding(doc, `5.${position}`, finding, requirementByRef.get(finding.ref));
      }
    }

    heading(doc, "6", "Plano de ação");
    const plan = actionPlan(report);
    if (plan.length === 0) {
      paragraph(doc, "Não há ações corretivas a registrar: todos os requisitos verificados foram considerados atendidos com base nas informações prestadas.");
    } else {
      paragraph(doc, "Ações necessárias antes da liberação da atividade, em ordem de prioridade. Responsável e prazo devem ser preenchidos pela empresa.");
      table(doc, [24, 104, 215, 90, 70], ["Nº", "Item", "Ação recomendada", "Responsável", "Prazo"],
        plan.map((row, index) => [String(index + 1), `${row.ref}\n(${STATUS_LABEL[row.status]})`, row.action, "", ""]));
    }

    if (report.risk_context.length > 0) {
      heading(doc, "7", "Contexto de acidentes no setor");
      paragraph(doc, "Dados das Comunicações de Acidente de Trabalho publicadas pelo INSS. Apoiam a priorização, mas não determinam conformidade.");
      report.risk_context.forEach((trend) => drawTrend(doc, trend));
    }

    const next = report.risk_context.length > 0 ? 8 : 7;
    heading(doc, String(next), "Conclusão");
    paragraph(doc, conclusion(report));

    heading(doc, String(next + 1), "Limitações e responsabilidade técnica");
    paragraph(doc,
      "Este documento é uma minuta elaborada com apoio de inteligência artificial a partir de informações declaradas. " +
      "Não constitui laudo, parecer técnico, Análise de Risco, Permissão de Trabalho nem autorização para execução, e não " +
      "substitui a leitura integral das normas citadas. Sua validade como documento da empresa depende da revisão, da " +
      "conferência em campo das evidências e da assinatura de profissional legalmente habilitado, que responde pelo conteúdo.");
    drawSignatures(doc, report);

    if (report.answers.length > 0) {
      doc.addPage();
      heading(doc, "Anexo A", "Registro da entrevista");
      paragraph(doc, "Perguntas feitas e respostas registradas, na ordem em que ocorreram.");
      table(doc, [24, 239, 240], ["Nº", "Pergunta", "Resposta registrada"],
        report.answers.map((qa, index) => [String(index + 1), qa.question, qa.answer]));
    }

    drawFooters(doc, code);
    doc.end();
  });
}
