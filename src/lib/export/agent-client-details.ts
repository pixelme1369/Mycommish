/**
 * Agent Client Details multi-sheet export for a calculated period.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { ClientEventKind, PeriodSource } from "@/generated/prisma/client";
import { getCordobaFlags } from "@/lib/portal/queries";
import { subtractStatusLabel } from "@/lib/export/commission-history-format";
import {
  AGENT_CLIENT_DETAIL_HEADERS,
  buildDashboardRepRow,
  rateAsPercentNumber,
  splitUnitsForDashboard,
  uniqueSheetName,
  type DashboardRepRow,
} from "./agent-client-details-format";

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

function typeLabel(kind: ClientEventKind, clawbackApplied: boolean, isCleared: boolean): string {
  if (isClawbackRow(kind, clawbackApplied)) return "Clawback";
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
  return kind;
}

async function loadPaidPeriodByCrmId(crmIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(crmIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const paid = await prisma.clientEvent.findMany({
    where: { crmId: { in: unique }, isCleared: true },
    select: {
      crmId: true,
      originalClearedPeriod: true,
      period: { select: { periodLabel: true } },
    },
    orderBy: { period: { periodLabel: "asc" } },
  });

  for (const row of paid) {
    if (map.has(row.crmId)) continue;
    const label = (row.originalClearedPeriod || "").trim() || row.period.periodLabel;
    if (label) map.set(row.crmId, label);
  }
  return map;
}

type DetailEvent = {
  crmId: string;
  agentName: string;
  clientName: string | null;
  enrolledDate: string | null;
  enrolledDebt: unknown;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  paymentsMade: number;
  payFreq: string | null;
  creditScore: number | null;
  isLowCredit: boolean;
  commissionOnClient: unknown;
  clawbackAmount: unknown;
  kind: ClientEventKind;
  clawbackApplied: boolean;
  isCleared: boolean;
  originalClearedPeriod: string | null;
  identity: {
    externalId: string | null;
    crmStatus: string | null;
  } | null;
};

type AgentBundle = {
  agentPeriodId: string;
  agentName: string;
  tier: number;
  tierRate: number;
  unitsCleared: number;
  totalClearedDebt: number;
  clawbackAmount: number;
  manualBonusAmount: number;
  netCommission: number;
  events: DetailEvent[];
};

function isRevShareUnit(e: DetailEvent): boolean {
  if (e.kind === ClientEventKind.low_credit_cleared) return true;
  if (e.isLowCredit) return true;
  if (e.creditScore != null && e.creditScore < 500) return true;
  return false;
}

/** Count paying units vs RevShares (FICO < 500) among cleared/paid files. */
function countUnitSplit(events: DetailEvent[]) {
  let paidCount = 0;
  let revShares = 0;
  for (const e of events) {
    if (isClawbackRow(e.kind, e.clawbackApplied)) continue;
    if (!isPaidRow(e.kind, e.isCleared)) continue;
    paidCount += 1;
    if (isRevShareUnit(e)) revShares += 1;
  }
  return splitUnitsForDashboard({
    totalClearedUnits: paidCount,
    revShareUnits: revShares,
  });
}

function yesNo(v: boolean): string {
  return v ? "Yes" : "No";
}

function moneyFmt(cell: ExcelJS.Cell) {
  cell.numFmt = '"$"#,##0.00;[Red]\\-"$"#,##0.00';
}

function detailRowValues(opts: {
  agentName: string;
  tier: number;
  ratePct: number;
  event: DetailEvent;
  paidPeriodByCrmId: Map<string, string>;
  paidIds: Set<string>;
  chargebackSeenIds: Set<string>;
}): (string | number | null)[] {
  const e = opts.event;
  const claw = isClawbackRow(e.kind, e.clawbackApplied);
  const paid = isPaidRow(e.kind, e.isCleared);
  const fileId = (e.identity?.externalId || e.crmId || "").trim();
  const debt = num(e.enrolledDebt);
  const commission = num(e.commissionOnClient);
  const clawAmt = Math.abs(num(e.clawbackAmount));

  let status = (e.identity?.crmStatus || "").trim();
  if (claw) {
    status = subtractStatusLabel(
      (e.originalClearedPeriod || "").trim() || opts.paidPeriodByCrmId.get(e.crmId),
    );
  } else if (!status) {
    status = "Active";
  }

  return [
    opts.agentName,
    opts.tier || null,
    opts.ratePct,
    typeLabel(e.kind, e.clawbackApplied, e.isCleared),
    fileId,
    e.clientName || "",
    e.enrolledDate || "",
    debt || null,
    status,
    e.firstPaymentClearedDate || "",
    // CRM parses 2nd payment / # NSF but we don't persist them yet.
    null,
    e.droppedDate || "",
    e.paymentsMade || 0,
    e.payFreq || "",
    null,
    e.creditScore ?? null,
    paid && !claw ? commission : null,
    claw && clawAmt ? -clawAmt : null,
    paid || claw ? yesNo(opts.paidIds.has(e.crmId)) : null,
    paid || claw ? yesNo(opts.chargebackSeenIds.has(e.crmId)) : null,
  ];
}

function appendDetailRow(ws: ExcelJS.Worksheet, values: (string | number | null)[]) {
  const row = ws.addRow(values);
  moneyFmt(row.getCell(8));
  if (values[16] != null) moneyFmt(row.getCell(17));
  if (values[17] != null) moneyFmt(row.getCell(18));
  return row;
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true };
}

function setDetailColumnWidths(ws: ExcelJS.Worksheet) {
  const widths = [18, 6, 8, 12, 14, 22, 14, 14, 28, 16, 16, 12, 10, 12, 8, 10, 16, 14, 12, 14];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function writeDashboard(ws: ExcelJS.Worksheet, reps: DashboardRepRow[]) {
  ws.getCell("A1").value = "Enrolled debt by Rep";
  ws.getCell("A1").font = { bold: true, size: 12 };
  ws.getCell("H1").value = "Commission payout";
  ws.getCell("H1").font = { bold: true, size: 12 };

  const leftHeaders = [
    "Sales Rep",
    "Sum of Enrolled Debt",
    "Sum of To Subtract",
    "Sum of Units",
    "RevShares",
    "Total Units",
  ];
  const rightHeaders = ["Sales Rep", "Rate %", "Upscore", "Bonus", "Total Commissions"];
  leftHeaders.forEach((h, i) => {
    ws.getCell(2, i + 1).value = h;
    ws.getCell(2, i + 1).font = { bold: true };
  });
  rightHeaders.forEach((h, i) => {
    ws.getCell(2, i + 8).value = h;
    ws.getCell(2, i + 8).font = { bold: true };
  });

  let sumDebt = 0;
  let sumSub = 0;
  let sumUnits = 0;
  let sumRev = 0;
  let sumTotalUnits = 0;
  let sumBonus = 0;
  let sumComm = 0;

  reps.forEach((r, idx) => {
    const row = idx + 3;
    ws.getCell(row, 1).value = r.salesRep;
    ws.getCell(row, 2).value = r.enrolledDebt;
    moneyFmt(ws.getCell(row, 2));
    ws.getCell(row, 3).value = r.toSubtract || null;
    if (r.toSubtract) moneyFmt(ws.getCell(row, 3));
    ws.getCell(row, 4).value = r.units;
    ws.getCell(row, 5).value = r.revShares || null;
    ws.getCell(row, 6).value = r.totalUnits;

    ws.getCell(row, 8).value = r.salesRep;
    ws.getCell(row, 9).value = r.ratePct;
    ws.getCell(row, 9).numFmt = "0.00";
    ws.getCell(row, 10).value = r.upscore || null;
    if (r.upscore) moneyFmt(ws.getCell(row, 10));
    ws.getCell(row, 11).value = r.bonus || null;
    if (r.bonus) moneyFmt(ws.getCell(row, 11));
    ws.getCell(row, 12).value = r.totalCommissions;
    moneyFmt(ws.getCell(row, 12));

    sumDebt += r.enrolledDebt;
    sumSub += r.toSubtract;
    sumUnits += r.units;
    sumRev += r.revShares;
    sumTotalUnits += r.totalUnits;
    sumBonus += r.bonus;
    sumComm += r.totalCommissions;
  });

  const totalRow = reps.length + 3;
  ws.getCell(totalRow, 1).value = "Grand Total";
  ws.getCell(totalRow, 1).font = { bold: true };
  ws.getCell(totalRow, 2).value = sumDebt;
  moneyFmt(ws.getCell(totalRow, 2));
  ws.getCell(totalRow, 3).value = sumSub || null;
  if (sumSub) moneyFmt(ws.getCell(totalRow, 3));
  ws.getCell(totalRow, 4).value = sumUnits;
  ws.getCell(totalRow, 5).value = sumRev || null;
  ws.getCell(totalRow, 6).value = sumTotalUnits;
  for (let c = 1; c <= 6; c++) ws.getCell(totalRow, c).font = { bold: true };

  const agentTotalRow = totalRow + 2;
  ws.getCell(agentTotalRow, 11).value = "Agent Commissions";
  ws.getCell(agentTotalRow, 11).font = { bold: true };
  ws.getCell(agentTotalRow, 12).value = sumComm;
  moneyFmt(ws.getCell(agentTotalRow, 12));
  ws.getCell(agentTotalRow, 12).font = { bold: true };

  // Suppress unused warning for sumBonus — shown in Bonus column totals if needed later
  void sumBonus;

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 12;
  ws.getColumn(8).width = 18;
  ws.getColumn(9).width = 10;
  ws.getColumn(10).width = 10;
  ws.getColumn(11).width = 12;
  ws.getColumn(12).width = 16;
}

export type AgentClientDetailsBuildResult = {
  buffer: Buffer;
  filename: string;
  agentCount: number;
  clientRowCount: number;
  chargebackRowCount: number;
};

export async function buildAgentClientDetailsWorkbook(opts: {
  periodId: string;
  agentPeriodIds: string[];
}): Promise<AgentClientDetailsBuildResult | null> {
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

  const eventsByAp = new Map<string, DetailEvent[]>();
  for (const e of events) {
    if (!e.agentPeriodId) continue;
    const list = eventsByAp.get(e.agentPeriodId) ?? [];
    list.push(e);
    eventsByAp.set(e.agentPeriodId, list);
  }

  const bundles: AgentBundle[] = agentPeriods.map((a) => ({
    agentPeriodId: a.id,
    agentName: a.agentName,
    tier: a.adjustedTier,
    tierRate: Number(a.tierRate),
    unitsCleared: a.unitsCleared,
    totalClearedDebt: num(a.totalClearedDebt),
    clawbackAmount: num(a.clawbackAmount),
    manualBonusAmount: num(a.manualBonusAmount),
    netCommission: num(a.netCommission),
    events: eventsByAp.get(a.id) ?? [],
  }));

  const allCrmIds = events.map((e) => e.crmId);
  const clawCrmIds = events
    .filter((e) => isClawbackRow(e.kind, e.clawbackApplied))
    .map((e) => e.crmId);
  const [cordoba, paidPeriodByCrmId] = await Promise.all([
    getCordobaFlags(allCrmIds),
    loadPaidPeriodByCrmId(clawCrmIds),
  ]);
  for (const e of events) {
    const orig = (e.originalClearedPeriod || "").trim();
    if (orig && isClawbackRow(e.kind, e.clawbackApplied)) {
      paidPeriodByCrmId.set(e.crmId, orig);
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";

  const dashboardRows = bundles.map((b) => {
    const fromEvents = countUnitSplit(b.events);
    // Prefer event counts; fall back to AgentPeriod.unitsCleared if no detail rows yet.
    const { units, revShares } =
      fromEvents.totalUnits > 0
        ? fromEvents
        : splitUnitsForDashboard({
            totalClearedUnits: b.unitsCleared,
            revShareUnits: 0,
          });
    return buildDashboardRepRow({
      salesRep: b.agentName,
      enrolledDebt: b.totalClearedDebt,
      clawbackAmount: b.clawbackAmount,
      units,
      revShares,
      tierRate: b.tierRate,
      bonus: b.manualBonusAmount,
      totalCommissions: b.netCommission,
    });
  });

  const dash = wb.addWorksheet("Dashboard Summary");
  writeDashboard(dash, dashboardRows);

  const allAgents = wb.addWorksheet("All Agents");
  allAgents.addRow([...AGENT_CLIENT_DETAIL_HEADERS]);
  styleHeaderRow(allAgents, 1);
  setDetailColumnWidths(allAgents);

  const allChargeback = wb.addWorksheet("All Chargeback");
  allChargeback.addRow([...AGENT_CLIENT_DETAIL_HEADERS]);
  styleHeaderRow(allChargeback, 1);
  setDetailColumnWidths(allChargeback);

  let clientRowCount = 0;
  let chargebackRowCount = 0;
  const usedNames = new Set<string>([
    "dashboard summary",
    "all agents",
    "all chargeback",
  ]);

  for (const b of bundles) {
    const ratePct = rateAsPercentNumber(b.tierRate);
    const sheet = wb.addWorksheet(uniqueSheetName(b.agentName, usedNames));
    sheet.addRow([...AGENT_CLIENT_DETAIL_HEADERS]);
    styleHeaderRow(sheet, 1);
    setDetailColumnWidths(sheet);

    for (const e of b.events) {
      const claw = isClawbackRow(e.kind, e.clawbackApplied);
      const paid = isPaidRow(e.kind, e.isCleared);
      // Keep agent sheets focused on commissionable + clawback files (skip pending noise).
      if (!claw && !paid && e.kind !== ClientEventKind.same_month_cancel) continue;

      const values = detailRowValues({
        agentName: b.agentName,
        tier: b.tier,
        ratePct,
        event: e,
        paidPeriodByCrmId,
        paidIds: cordoba.paidIds,
        chargebackSeenIds: cordoba.chargebackSeenIds,
      });

      appendDetailRow(allAgents, values);
      appendDetailRow(sheet, values);
      clientRowCount += 1;

      if (claw) {
        appendDetailRow(allChargeback, values);
        chargebackRowCount += 1;
      }
    }
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `agent-client-details-${period.periodLabel}.xlsx`;
  return {
    buffer,
    filename,
    agentCount: bundles.length,
    clientRowCount,
    chargebackRowCount,
  };
}
