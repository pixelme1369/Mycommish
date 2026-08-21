/**
 * Build an agent commission .xlsx (exceljs) — client rows with Type/kind,
 * plus optional Cordoba Charge back block for reconciliation.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { ClientEventKind, PeriodSource } from "@/generated/prisma/client";
import { getCordobaFlags, mergeClawbacksWithCordoba } from "@/lib/portal/queries";

const CLIENT_HEADERS = [
  "Type",
  "ID",
  "Client Name",
  "Enrolled Date",
  "Enrolled Debt",
  "Kind",
  "1st Payment Cleared",
  "Dropped Date",
  "Payments Made",
  "Pay Freq.",
  "Credit Score",
  "Commission on Client",
  "Clawback Amount",
  "Cordoba Payout",
  "Cordoba Clawback",
  "Cordoba Charge back",
] as const;

function typeLabel(kind: ClientEventKind, clawbackApplied: boolean, isCleared: boolean): string {
  if (clawbackApplied || kind === ClientEventKind.clawback || kind === ClientEventKind.cordoba_clawback) {
    return "Clawback";
  }
  if (kind === ClientEventKind.pending) return "Pending Cancellation";
  if (kind === ClientEventKind.safe_cancel) return "Safe cancel";
  if (kind === ClientEventKind.same_month_cancel) return "Cancelled";
  if (
    kind === ClientEventKind.cleared ||
    kind === ClientEventKind.low_credit_cleared ||
    isCleared
  ) {
    return "Cleared";
  }
  if (kind === ClientEventKind.history_paid) return "History paid";
  if (kind === ClientEventKind.history_subtract) return "History subtract";
  return kind;
}

function num(n: unknown) {
  return Number(n) || 0;
}

export async function buildAgentPeriodWorkbook(periodId: string, agentPeriodId: string) {
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

  const { paidIds, chargebackSeenIds } = await getCordobaFlags(events.map((e) => e.crmId));
  const clawbacks = events.filter(
    (e) =>
      e.clawbackApplied ||
      e.kind === ClientEventKind.clawback ||
      e.kind === ClientEventKind.cordoba_clawback,
  );
  const merged = await mergeClawbacksWithCordoba(
    row.agentName,
    row.period.periodLabel,
    clawbacks,
  );
  const chargeBackYes = new Set(
    merged.filter((m) => m.cordobaChargeBack).map((m) => m.crmId),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  const ws = wb.addWorksheet("Clients");

  ws.addRow([
    "Agent",
    row.agentName,
    "Period",
    row.period.periodLabel,
    "Units",
    row.unitsCleared,
    "Tier",
    row.adjustedTier,
    "Rate",
    Number(row.tierRate),
    "Gross",
    num(row.grossCommission),
    "Net",
    num(row.netCommission),
  ]);
  ws.addRow([]);
  ws.addRow([...CLIENT_HEADERS]);

  const headerRow = ws.getRow(3);
  headerRow.font = { bold: true };

  const nonClawback = events.filter(
    (e) =>
      !(
        e.clawbackApplied ||
        e.kind === ClientEventKind.clawback ||
        e.kind === ClientEventKind.cordoba_clawback
      ),
  );

  for (const e of nonClawback) {
    const cleared =
      e.kind === ClientEventKind.cleared ||
      e.kind === ClientEventKind.low_credit_cleared ||
      e.isCleared;
    ws.addRow([
      typeLabel(e.kind, e.clawbackApplied, e.isCleared),
      e.crmId,
      e.clientName || "",
      e.enrolledDate || "",
      num(e.enrolledDebt),
      e.kind,
      e.firstPaymentClearedDate || "",
      e.droppedDate || "",
      e.paymentsMade,
      e.payFreq || "",
      e.creditScore ?? "",
      cleared ? num(e.commissionOnClient) : "",
      "",
      cleared ? (paidIds.has(e.crmId) ? "Yes" : "No") : "",
      cleared ? (chargebackSeenIds.has(e.crmId) ? "Yes" : "No") : "",
      "",
    ]);
  }

  for (const c of merged) {
    ws.addRow([
      c.cordobaOnly ? "Cordoba flagged" : "Clawback",
      c.crmId,
      c.clientName || "",
      "",
      num(c.enrolledDebt),
      c.kind,
      c.firstPaymentClearedDate || "",
      c.droppedDate || "",
      "",
      "",
      "",
      "",
      c.clawbackAmount ? -Math.abs(c.clawbackAmount) : 0,
      "",
      "",
      c.cordobaChargeBack || chargeBackYes.has(c.crmId) ? "Yes" : "No",
    ]);
  }

  for (let i = 1; i <= CLIENT_HEADERS.length; i++) {
    ws.getColumn(i).width = i === 3 ? 24 : i === 6 ? 18 : 14;
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safeName = row.agentName.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") || "agent";
  const filename = `${safeName}_${row.period.periodLabel}.xlsx`;

  return { buffer, filename, agentName: row.agentName, periodLabel: row.period.periodLabel };
}
