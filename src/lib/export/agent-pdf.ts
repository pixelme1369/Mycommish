/**
 * Printable commission statement PDF for agent signature before payout release.
 * Layout mirrors the legacy spreadsheet statement (summary + client lines + sign-off).
 */

import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { ClientEventKind, PeriodSource } from "@/generated/prisma/client";

function num(n: unknown) {
  return Number(n) || 0;
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function periodDisplayLabel(periodLabel: string) {
  try {
    const [y, m] = periodLabel.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return periodLabel;
  }
}

function ratePct(fraction: number) {
  return `${(fraction * 100).toFixed(2)}%`;
}

type Line = {
  crmId: string;
  clientName: string;
  enrolledDate: string;
  enrolledDebt: number;
  status: string;
  clearedDate: string;
  droppedDate: string;
  paymentsMade: number;
  payFreq: string;
  commission: number;
  clawback: number;
  kind: "cleared" | "clawback";
};

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function buildAgentCommissionStatementPdf(
  periodId: string,
  agentPeriodId: string,
) {
  const row = await prisma.agentPeriod.findFirst({
    where: {
      id: agentPeriodId,
      periodId,
      period: { source: PeriodSource.calculated },
    },
    include: { period: true },
  });
  if (!row) return null;

  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId: row.id },
    orderBy: [{ clientName: "asc" }, { crmId: "asc" }],
  });

  const lines: Line[] = [];
  for (const e of events) {
    const isCb =
      e.clawbackApplied ||
      e.kind === ClientEventKind.clawback ||
      e.kind === ClientEventKind.cordoba_clawback;
    const isCleared =
      !isCb &&
      (e.kind === ClientEventKind.cleared ||
        e.kind === ClientEventKind.low_credit_cleared ||
        e.isCleared);
    if (!isCb && !isCleared) continue; // statement focuses on paid + clawbacks

    lines.push({
      crmId: e.crmId,
      clientName: e.clientName || "",
      enrolledDate: e.enrolledDate || "",
      enrolledDebt: num(e.enrolledDebt),
      status: isCb ? "Clawback" : e.kind === ClientEventKind.low_credit_cleared ? "Low credit" : "Cleared",
      clearedDate: e.firstPaymentClearedDate || "",
      droppedDate: e.droppedDate || "",
      paymentsMade: e.paymentsMade,
      payFreq: e.payFreq || "",
      commission: isCb ? 0 : num(e.commissionOnClient),
      clawback: isCb ? num(e.clawbackAmount) : 0,
      kind: isCb ? "clawback" : "cleared",
    });
  }

  const periodName = periodDisplayLabel(row.period.periodLabel);
  const gross = num(row.grossCommission);
  const clawbackTotal = num(row.clawbackAmount);
  const net = num(row.netCommission);
  const debt = num(row.totalClearedDebt);
  const rate = num(row.tierRate);

  const doc = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margin: 36,
    info: {
      Title: `${periodName} Commission Statement — ${row.agentName}`,
      Author: "mycommish",
    },
  });
  const done = collectBuffer(doc);

  const pageW = doc.page.width;
  const left = 36;
  const right = pageW - 36;
  const usable = right - left;

  // Title
  doc
    .fillColor("#1d4ed8")
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(`${periodName} Commission Statement — ${row.agentName}`, left, 36, {
      width: usable,
    });

  doc.moveDown(0.6);
  let y = doc.y;

  doc.fillColor("#111827").font("Helvetica").fontSize(9);
  const summary = [
    [`Commission Rate:`, ratePct(rate)],
    [`Enrolled Debt:`, money(debt)],
    [`Commission on Enrolled Debt:`, money(gross)],
    [`Chargeback Deduction:`, money(clawbackTotal)],
  ];
  for (const [label, value] of summary) {
    doc.font("Helvetica").text(label, left, y, { continued: true });
    doc.font("Helvetica-Bold").text(`  ${value}`);
    y = doc.y + 2;
  }

  y += 4;
  doc
    .fillColor("#b91c1c")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`TOTAL COMMISSION DUE: ${money(net)}`, left, y);
  y = doc.y + 12;

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("Client Detail", left, y);
  y = doc.y + 8;

  // Table
  const cols: { key: keyof Line | "commissionOrCb"; label: string; w: number; align?: "left" | "right" }[] = [
    { key: "crmId", label: "ID", w: 72 },
    { key: "clientName", label: "Client Name", w: 130 },
    { key: "enrolledDate", label: "Enrolled", w: 58 },
    { key: "enrolledDebt", label: "Enrolled Debt", w: 72, align: "right" },
    { key: "status", label: "Status", w: 58 },
    { key: "clearedDate", label: "1st Cleared", w: 58 },
    { key: "droppedDate", label: "Dropped", w: 58 },
    { key: "paymentsMade", label: "Pays", w: 32, align: "right" },
    { key: "payFreq", label: "Pay Freq.", w: 58 },
    { key: "commissionOrCb", label: "Amount", w: 70, align: "right" },
  ];

  const drawHeader = (top: number) => {
    let x = left;
    doc.rect(left, top, usable, 16).fill("#e5e7eb");
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7);
    for (const c of cols) {
      doc.text(c.label, x + 2, top + 4, { width: c.w - 4, align: c.align || "left" });
      x += c.w;
    }
    return top + 18;
  };

  const rowH = 12;
  const footerNeed = 110;
  y = drawHeader(y);

  let sumDebt = 0;
  let sumComm = 0;

  const ensureSpace = (need: number) => {
    if (y + need > doc.page.height - 36) {
      doc.addPage();
      y = 36;
      y = drawHeader(y);
    }
  };

  for (const line of lines) {
    ensureSpace(rowH + 2);
    let x = left;
    doc.fillColor("#111827").font("Helvetica").fontSize(7);
    const amount =
      line.kind === "clawback" ? -Math.abs(line.clawback) : line.commission;
    if (line.kind === "cleared") {
      sumDebt += line.enrolledDebt;
    }
    sumComm += amount;

    const cells: string[] = [
      line.crmId,
      line.clientName,
      line.enrolledDate,
      money(line.enrolledDebt),
      line.status,
      line.clearedDate,
      line.droppedDate,
      String(line.paymentsMade),
      line.payFreq,
      money(amount),
    ];

    cells.forEach((text, i) => {
      const c = cols[i];
      if (line.kind === "clawback" && i === cells.length - 1) {
        doc.fillColor("#b91c1c");
      } else {
        doc.fillColor("#111827");
      }
      doc.text(text, x + 2, y, {
        width: c.w - 4,
        align: c.align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      x += c.w;
    });
    y += rowH;
  }

  // Totals row (cleared debt / commission listed)
  ensureSpace(20);
  doc.rect(left, y, usable, 14).fill("#dbeafe");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7);
  doc.text("TOTAL (all clients listed above)", left + 2, y + 3, { width: 220 });
  doc.text(money(sumDebt), left + cols[0].w + cols[1].w + cols[2].w + 2, y + 3, {
    width: cols[3].w - 4,
    align: "right",
  });
  const amountColX = left + cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
  doc.text(money(sumComm), amountColX + 2, y + 3, {
    width: cols[cols.length - 1].w - 4,
    align: "right",
  });
  y += 28;

  // Signature block
  ensureSpace(footerNeed);
  doc
    .fillColor("#374151")
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text(
      `I have reviewed the commission detail above for ${periodName} (including any chargeback deductions) and confirm it is accurate.`,
      left,
      y,
      { width: usable },
    );
  y = doc.y + 18;

  const sigW = usable * 0.55;
  const dateW = usable * 0.28;
  const gap = usable * 0.05;

  const drawSig = (label: string, top: number) => {
    doc.fillColor("#111827").font("Helvetica").fontSize(8).text(label, left, top);
    doc
      .moveTo(left + 90, top + 10)
      .lineTo(left + sigW, top + 10)
      .strokeColor("#9ca3af")
      .stroke();
    doc.text("Date:", left + sigW + gap, top);
    doc
      .moveTo(left + sigW + gap + 32, top + 10)
      .lineTo(left + sigW + gap + dateW, top + 10)
      .stroke();
  };

  drawSig("Agent Signature", y);
  y += 28;
  drawSig("Manager Signature", y);

  doc.end();
  const buffer = await done;

  const safeName = row.agentName.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") || "agent";
  const filename = `${safeName}_${row.period.periodLabel}_commission_statement.pdf`;

  return { buffer, filename, agentName: row.agentName, periodLabel: row.period.periodLabel };
}
