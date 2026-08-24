/**
 * Commission History export — same columns as the history upload sheet,
 * so admins can archive a calculated period for future clawback / audit.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { ClientEventKind, PeriodSource } from "@/generated/prisma/client";
import {
  COMMISSION_HISTORY_HEADERS,
  monthNameFromPeriodLabel,
  rateAsPercentLabel,
  subtractStatusLabel,
} from "./commission-history-format";

export {
  COMMISSION_HISTORY_HEADERS,
  monthNameFromPeriodLabel,
  rateAsPercentLabel,
  subtractStatusLabel,
} from "./commission-history-format";

function num(n: unknown) {
  return Number(n) || 0;
}

function isClawbackRow(kind: ClientEventKind, clawbackApplied: boolean) {
  return (
    clawbackApplied ||
    kind === ClientEventKind.clawback ||
    kind === ClientEventKind.cordoba_clawback ||
    kind === ClientEventKind.history_subtract
  );
}

function isPaidRow(kind: ClientEventKind, isCleared: boolean) {
  if (kind === ClientEventKind.cleared) return true;
  if (kind === ClientEventKind.low_credit_cleared) return true;
  if (kind === ClientEventKind.safe_cancel) return true;
  if (kind === ClientEventKind.history_paid) return true;
  if (isCleared && kind !== ClientEventKind.same_month_cancel) return true;
  return false;
}

function paidStatusLabel(crmStatus: string | null | undefined): string {
  const fromCrm = (crmStatus || "").trim();
  return fromCrm || "Active";
}

/** Prefer explicit originalClearedPeriod, else look up when this file was paid. */
async function loadPaidPeriodByCrmId(crmIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(crmIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const paid = await prisma.clientEvent.findMany({
    where: {
      crmId: { in: unique },
      isCleared: true,
    },
    select: {
      crmId: true,
      originalClearedPeriod: true,
      period: { select: { periodLabel: true } },
    },
    orderBy: { period: { periodLabel: "asc" } },
  });

  for (const row of paid) {
    if (map.has(row.crmId)) continue;
    const label =
      (row.originalClearedPeriod || "").trim() || row.period.periodLabel;
    if (label) map.set(row.crmId, label);
  }
  return map;
}

export type CommissionHistoryBuildResult = {
  buffer: Buffer;
  filename: string;
  rowCount: number;
};

/**
 * Build a Commission History workbook for the selected agent periods in one calculated period.
 *
 * Paid rows fill Enrolled Debt + Commission on Client (Units = 1).
 * Clawback rows fill To subtract only (Enrolled Debt blank so history re-import treats them as subtracts).
 * ID prefers External ID (Cordoba / history sheet style), falls back to CRM ID.
 */
export async function buildCommissionHistoryWorkbook(opts: {
  periodId: string;
  agentPeriodIds: string[];
}): Promise<CommissionHistoryBuildResult | null> {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: opts.periodId, source: PeriodSource.calculated },
  });
  if (!period) return null;

  const agentPeriods = await prisma.agentPeriod.findMany({
    where: { periodId: opts.periodId, id: { in: opts.agentPeriodIds } },
    orderBy: { agentName: "asc" },
  });
  if (!agentPeriods.length) return null;

  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId: { in: agentPeriods.map((a) => a.id) } },
    include: { identity: { select: { externalId: true, crmStatus: true } } },
    orderBy: [{ agentName: "asc" }, { clientName: "asc" }, { crmId: "asc" }],
  });

  const clawCrmIds = events
    .filter((e) => isClawbackRow(e.kind, e.clawbackApplied))
    .map((e) => e.crmId);
  const paidPeriodByCrmId = await loadPaidPeriodByCrmId(clawCrmIds);
  // Also honor originalClearedPeriod on the clawback row itself when set.
  for (const e of events) {
    const orig = (e.originalClearedPeriod || "").trim();
    if (orig && isClawbackRow(e.kind, e.clawbackApplied)) {
      paidPeriodByCrmId.set(e.crmId, orig);
    }
  }

  const unitsByAp = new Map(agentPeriods.map((a) => [a.id, a.unitsCleared]));
  const rateByAp = new Map(agentPeriods.map((a) => [a.id, Number(a.tierRate)]));
  const month = monthNameFromPeriodLabel(period.periodLabel);

  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  const ws = wb.addWorksheet("Commission History");
  ws.addRow([...COMMISSION_HISTORY_HEADERS]);
  ws.getRow(1).font = { bold: true };

  let rowCount = 0;
  for (const e of events) {
    if (!e.agentPeriodId) continue;
    const claw = isClawbackRow(e.kind, e.clawbackApplied);
    const paid = isPaidRow(e.kind, e.isCleared);
    if (!claw && !paid) continue;

    const fileId = (e.identity?.externalId || e.crmId || "").trim();
    if (!fileId) continue;

    const unitsCount = unitsByAp.get(e.agentPeriodId) ?? 0;
    const tierRate = rateByAp.get(e.agentPeriodId) ?? 0;
    const paidRate = e.paidRate != null ? Number(e.paidRate) : null;
    const rate = paidRate != null && paidRate > 0 ? paidRate : tierRate;
    const debt = num(e.enrolledDebt);
    const commission = num(e.commissionOnClient);
    const clawAmt = Math.abs(num(e.clawbackAmount));
    // History sheets use negative To subtract (parser takes Math.abs on import).
    const toSubtract = claw && clawAmt ? -clawAmt : null;

    // History parser: Enrolled Debt → paid unit; To subtract alone → clawback.
    const row = claw
      ? ws.addRow([
          month,
          fileId,
          e.agentName,
          e.clientName || "",
          null,
          toSubtract,
          e.paymentsMade || 0,
          null,
          subtractStatusLabel(paidPeriodByCrmId.get(e.crmId)),
          rateAsPercentLabel(rate),
          unitsCount,
          null,
        ])
      : ws.addRow([
          month,
          fileId,
          e.agentName,
          e.clientName || "",
          debt,
          null,
          e.paymentsMade || 0,
          1,
          paidStatusLabel(e.identity?.crmStatus),
          rateAsPercentLabel(rate),
          unitsCount,
          commission,
        ]);

    if (!claw) row.getCell(5).numFmt = '"$"#,##0.00';
    if (claw && toSubtract != null) {
      row.getCell(6).numFmt = '"$"#,##0.00;[Red]\\-"$"#,##0.00';
    }
    if (!claw) row.getCell(12).numFmt = '"$"#,##0.00';

    rowCount += 1;
  }

  ws.columns.forEach((col) => {
    col.width = 16;
  });
  ws.getColumn(4).width = 22;
  ws.getColumn(12).width = 20;

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `commission-history-${period.periodLabel}.xlsx`;
  return { buffer, filename, rowCount };
}
