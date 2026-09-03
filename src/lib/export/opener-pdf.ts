import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import {
  formatOpenerPayDate,
  formatOpenerPayStatus,
  formatOpenerPeriodName,
  openerCommissionForPayStatus,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { money } from "@/lib/format";
import type { StatementSignatures } from "@/lib/export/agent-pdf";
import { getOpenerStatement } from "@/lib/opener/statements";
import { listOpenerLogsForAgent } from "@/lib/opener/logs";

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function bytesToBuffer(value: Uint8Array | Buffer | null | undefined): Buffer | null {
  if (!value) return null;
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

export async function buildOpenerCommissionStatementPdf(opts: {
  agentId: string;
  monthLabel: string;
}) {
  const { agentId, monthLabel } = opts;
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) return null;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, role: AgentRole.opener },
    select: { id: true, displayName: true },
  });
  if (!agent) return null;

  const [logs, upscoreRow, statement] = await Promise.all([
    listOpenerLogsForAgent(agentId, monthLabel),
    prisma.openerPeriodUpscore.findUnique({
      where: { agentId_monthLabel: { agentId, monthLabel } },
      select: { amount: true },
    }),
    getOpenerStatement(agentId, monthLabel),
  ]);

  const approved = logs.filter((r) => r.payStatus === "approved");
  const commissionTotal = approved.reduce(
    (s, r) =>
      s +
      openerCommissionForPayStatus(
        Number(r.debtLoad),
        r.payStatus as OpenerPayStatusName,
      ),
    0,
  );
  const upscore = Number(upscoreRow?.amount ?? statement?.upscore ?? 0);
  const totalPayout = commissionTotal + upscore;

  const signatures: StatementSignatures = {
    agent: statement?.agentSignedAt
      ? {
          typedName: statement.agentTypedName || agent.displayName,
          signedAt: statement.agentSignedAt,
          png: bytesToBuffer(statement.agentSignaturePng),
        }
      : null,
    manager: statement?.managerSignedAt
      ? {
          typedName: statement.managerTypedName || "Manager",
          signedAt: statement.managerSignedAt,
          png: bytesToBuffer(statement.managerSignaturePng),
        }
      : null,
  };

  const doc = new PDFDocument({ size: "LETTER", margin: 42 });
  const done = collectBuffer(doc);
  const left = 42;
  const usable = 528;
  const periodName = formatOpenerPeriodName(monthLabel);

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#1e4d8c").text("Opener Commission Statement");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#111827").text(agent.displayName);
  doc
    .fontSize(9)
    .fillColor("#4b5563")
    .text(`${periodName} · payday ${formatOpenerPayDate(monthLabel)}`);
  doc.moveDown(0.8);

  const summary = [
    ["Approved transfers", String(approved.length)],
    ["Commission total", money(commissionTotal)],
    ["Bonus / Upscore", money(upscore)],
    ["Total payout", money(totalPayout)],
  ];
  for (const [label, value] of summary) {
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(label, left, doc.y, { continued: true, width: 200 });
    doc.font("Helvetica-Bold").fillColor("#111827").text(value, { align: "right", width: usable });
  }

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  const headers = ["Transfer Date", "File ID", "Debt", "Status", "Commission", "Pay Status"];
  const widths = [88, 82, 80, 100, 80, 98];
  let x = left;
  const headY = doc.y;
  doc.rect(left, headY, usable, 16).fill("#1e4d8c");
  headers.forEach((h, i) => {
    doc.fillColor("#ffffff").text(h, x + 3, headY + 4, { width: widths[i] - 6 });
    x += widths[i];
  });
  doc.y = headY + 18;

  doc.font("Helvetica").fontSize(7).fillColor("#111827");
  for (const row of logs) {
    if (doc.y > 700) {
      doc.addPage();
    }
    const vals = [
      row.transferYmd,
      row.forthId,
      row.unmatched ? "—" : money(Number(row.debtLoad)),
      row.status || "—",
      row.unmatched ? "—" : money(openerCommissionForPayStatus(Number(row.debtLoad), row.payStatus as OpenerPayStatusName)),
      formatOpenerPayStatus(row.payStatus as OpenerPayStatusName),
    ];
    x = left;
    const y = doc.y;
    vals.forEach((v, i) => {
      doc.text(v, x + 3, y, { width: widths[i] - 6 });
      x += widths[i];
    });
    doc.y = y + 12;
  }

  doc.moveDown(1.2);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#374151")
    .text(
      `I have reviewed the opener commission detail above for ${periodName} and confirm it is accurate.`,
      left,
      doc.y,
      { width: usable },
    );

  const formatSignedDate = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });

  let y = doc.y + 16;
  const drawSig = (label: string, sig: StatementSignatures["agent"]) => {
    doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(label, left, y);
    y += 14;
    doc.moveTo(left, y + 16).lineTo(left + 260, y + 16).strokeColor("#d1d5db").stroke();
    if (sig?.png?.length) {
      try {
        doc.image(sig.png, left, y - 4, { height: 22, fit: [240, 22] });
      } catch {
        /* typed name below */
      }
    }
    if (sig?.typedName) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#111827").text(sig.typedName, left, y + 20);
    }
    if (sig?.signedAt) {
      doc.font("Helvetica").fontSize(8).text(formatSignedDate(sig.signedAt), left + 280, y);
    }
    y += 44;
  };
  drawSig("Opener signature", signatures.agent);
  drawSig("Manager signature", signatures.manager);

  doc.end();
  const buffer = await done;
  const safeName = agent.displayName.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") || "opener";
  return {
    buffer,
    filename: `${safeName}_${monthLabel}_opener_statement.pdf`,
  };
}
