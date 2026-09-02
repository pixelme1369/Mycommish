import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import {
  commissionOnFile,
  isLastCheckClawback,
  lastCheckCommission,
  lastCheckGustoAmount,
  lastCheckPaymentsVsThreshold,
  lastCheckSecondClearLabel,
  lastCheckTierLabel,
  passedLastCheckThreshold,
  wouldHaveBeenPaidCommission,
} from "@/lib/agents/last-check";
import { dismissalKey } from "@/lib/agents/dismissal";
import {
  latestCalculatedPeriods,
  paidPeriodLabels,
} from "@/lib/portal/queries";

function num(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export type LastCheckFileRow = {
  id: string;
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  periodLabel: string;
  enrolledDebt: number;
  commission: number;
  payFreq: string | null;
  paymentsMade: number;
  paymentsNeeded: number;
  thresholdPassed: boolean;
  firstPaymentClearedDate: string | null;
  secondPaymentClearedDate: string | null;
  secondClearLabel: string;
  droppedDate: string | null;
  kind: string;
};

export type LastCheckClawbackRow = {
  id: string;
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  periodLabel: string;
  enrolledDebt: number;
  clawbackAmount: number;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  payFreq: string | null;
  paymentsMade: number;
  kind: string;
};

export type LastCheckView = {
  agentPeriodId: string;
  periodId: string;
  periodLabel: string;
  periodLabels: string[];
  agentName: string;
  units: number;
  enrolledDebt: number;
  tierLabel: string;
  tierRate: number;
  grossCommission: number;
  clawbackAmount: number;
  gustoAmount: number;
  notes: string;
  gustoFirstName: string | null;
  gustoLastName: string | null;
  gustoEmployeeId: string | null;
  employmentType: "employee" | "contractor" | null;
  companyName: string | null;
  files: LastCheckFileRow[];
  clawbacks: LastCheckClawbackRow[];
};

export type LastCheckPreview = {
  agentPeriodId: string;
  periodLabel: string;
  agentName: string;
  units: number;
  enrolledDebt: number;
  tierLabel: string;
  tierRate: number;
  grossCommission: number;
  clawbackAmount: number;
  gustoAmount: number;
};

async function gustoProfile(agentName: string) {
  const alias = await prisma.agentAlias.findFirst({
    where: { agentName: { equals: agentName.trim(), mode: "insensitive" } },
    include: {
      agent: {
        select: {
          employmentType: true,
          companyName: true,
          gustoFirstName: true,
          gustoLastName: true,
          gustoEmployeeId: true,
        },
      },
    },
  });
  if (!alias) {
    return {
      employmentType: null as "employee" | "contractor" | null,
      companyName: null as string | null,
      gustoFirstName: null as string | null,
      gustoLastName: null as string | null,
      gustoEmployeeId: null as string | null,
    };
  }
  return {
    employmentType: alias.agent.employmentType as "employee" | "contractor",
    companyName: alias.agent.companyName,
    gustoFirstName: alias.agent.gustoFirstName,
    gustoLastName: alias.agent.gustoLastName,
    gustoEmployeeId: alias.agent.gustoEmployeeId,
  };
}

async function siblingAgentNames(agentName: string): Promise<string[]> {
  const trimmed = agentName.trim();
  const alias = await prisma.agentAlias.findFirst({
    where: { agentName: { equals: trimmed, mode: "insensitive" } },
    include: { agent: { include: { aliases: { select: { agentName: true } } } } },
  });
  if (!alias) return [trimmed];
  const names = alias.agent.aliases.map((a) => a.agentName);
  return names.length ? names : [trimmed];
}

/** Latest calculated months that have not been logged as paid (portal upcoming window). */
export async function upcomingUnpaidCalculatedPeriods() {
  const latest = await latestCalculatedPeriods();
  if (!latest.length) return [];
  const paid = await paidPeriodLabels(latest.map((p) => p.periodLabel));
  return latest.filter((p) => !paid.has(p.periodLabel));
}

function identitySelect() {
  return {
    externalId: true,
    payFreq: true,
    paymentsMade: true,
    firstPaymentClearedDate: true,
    secondPaymentClearedDate: true,
    enrolledDebt: true,
    droppedDate: true,
  } as const;
}

export async function loadLastCheck(agentPeriodId: string): Promise<LastCheckView | null> {
  const anchor = await prisma.agentPeriod.findFirst({
    where: { id: agentPeriodId, period: { source: PeriodSource.calculated } },
    include: { period: { select: { id: true, periodLabel: true } } },
  });
  if (!anchor) return null;

  const names = await siblingAgentNames(anchor.agentName);
  const nameKeys = new Set(names.map((n) => dismissalKey(n)));
  let upcoming = await upcomingUnpaidCalculatedPeriods();
  let agentPeriods = upcoming.length
    ? await prisma.agentPeriod.findMany({
        where: {
          periodId: { in: upcoming.map((p) => p.id) },
          OR: names.map((n) => ({
            agentName: { equals: n, mode: "insensitive" as const },
          })),
        },
        include: { period: { select: { id: true, periodLabel: true } } },
      })
    : [];
  agentPeriods = agentPeriods.filter((r) => nameKeys.has(dismissalKey(r.agentName)));

  if (!agentPeriods.length) {
    agentPeriods = [anchor];
  }

  agentPeriods.sort((a, b) => b.period.periodLabel.localeCompare(a.period.periodLabel));
  const primary = agentPeriods[0]!;
  const periodByApId = new Map(agentPeriods.map((ap) => [ap.id, ap]));
  const rateByApId = new Map(agentPeriods.map((ap) => [ap.id, num(ap.tierRate)]));

  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId: { in: agentPeriods.map((ap) => ap.id) } },
    include: { identity: { select: identitySelect() } },
    orderBy: [{ clientName: "asc" }, { crmId: "asc" }],
  });

  const snapshots = events.map((e) => {
    const ap = e.agentPeriodId ? periodByApId.get(e.agentPeriodId) : undefined;
    const periodLabel = ap?.period.periodLabel ?? "";
    const identity = e.identity;
    const payFreq = identity?.payFreq || e.payFreq;
    const paymentsMade = Math.max(identity?.paymentsMade ?? 0, e.paymentsMade ?? 0);
    const firstPaymentClearedDate =
      identity?.firstPaymentClearedDate || e.firstPaymentClearedDate;
    const secondPaymentClearedDate =
      identity?.secondPaymentClearedDate || e.secondPaymentClearedDate;
    const enrolledDebt =
      identity?.enrolledDebt != null ? num(identity.enrolledDebt) : num(e.enrolledDebt);
    const droppedDate = identity?.droppedDate || e.droppedDate;
    const payments = lastCheckPaymentsVsThreshold(paymentsMade, payFreq);
    const tierRate = e.agentPeriodId ? (rateByApId.get(e.agentPeriodId) ?? 0) : 0;
    return {
      event: e,
      periodLabel,
      payFreq,
      paymentsMade: payments.made,
      paymentsNeeded: payments.needed,
      firstPaymentClearedDate,
      secondPaymentClearedDate,
      enrolledDebt,
      droppedDate,
      tierRate,
    };
  });

  const passed = snapshots.filter(
    (s) =>
      wouldHaveBeenPaidCommission(s.event) &&
      passedLastCheckThreshold({
        periodLabel: s.periodLabel,
        firstPaymentClearedDate: s.firstPaymentClearedDate,
        secondPaymentClearedDate: s.secondPaymentClearedDate,
        payFreq: s.payFreq,
        paymentsMade: s.paymentsMade,
        clawbackApplied: s.event.clawbackApplied,
        kind: s.event.kind,
      }),
  );

  const clawbackSnapshots = snapshots.filter(
    (s) => isLastCheckClawback(s.event) && num(s.event.clawbackAmount) > 0,
  );

  const enrolledDebt = passed.reduce((sum, s) => sum + s.enrolledDebt, 0);
  const units = passed.length;
  const cancelPct = num(primary.cancellationRate);
  const calc = lastCheckCommission({
    agentName: primary.agentName,
    unitsCleared: units,
    totalClearedDebt: enrolledDebt,
    cancellationRatePct: cancelPct,
  });
  const files: LastCheckFileRow[] = passed.map((s) => ({
    id: s.event.id,
    crmId: s.event.crmId,
    externalId: s.event.identity?.externalId ?? null,
    clientName: s.event.clientName,
    periodLabel: s.periodLabel,
    enrolledDebt: s.enrolledDebt,
    commission: commissionOnFile(s.enrolledDebt, s.tierRate),
    payFreq: s.payFreq,
    paymentsMade: s.paymentsMade,
    paymentsNeeded: s.paymentsNeeded,
    thresholdPassed: true,
    firstPaymentClearedDate: s.firstPaymentClearedDate,
    secondPaymentClearedDate: s.secondPaymentClearedDate,
    secondClearLabel: lastCheckSecondClearLabel(s.secondPaymentClearedDate),
    droppedDate: s.droppedDate,
    kind: s.event.kind,
  }));
  const grossCommission = files.reduce((sum, f) => sum + f.commission, 0);
  const clawbacks: LastCheckClawbackRow[] = clawbackSnapshots.map((s) => ({
    id: s.event.id,
    crmId: s.event.crmId,
    externalId: s.event.identity?.externalId ?? null,
    clientName: s.event.clientName,
    periodLabel: s.periodLabel,
    enrolledDebt: s.enrolledDebt,
    clawbackAmount: num(s.event.clawbackAmount),
    firstPaymentClearedDate: s.firstPaymentClearedDate,
    droppedDate: s.droppedDate,
    payFreq: s.payFreq,
    paymentsMade: s.paymentsMade,
    kind: s.event.kind,
  }));
  const clawbackAmount = clawbacks.reduce((sum, c) => sum + c.clawbackAmount, 0);
  const gustoAmount = lastCheckGustoAmount({
    grossCommission,
    clawbackAmount,
    manualBonusAmount: agentPeriods.reduce((s, ap) => s + num(ap.manualBonusAmount), 0),
    advancePaidAmount: agentPeriods.reduce((s, ap) => s + num(ap.advancePaidAmount), 0),
    advanceRepayAmount: agentPeriods.reduce((s, ap) => s + num(ap.advanceRepayAmount), 0),
    teamLeadBonusAmount: agentPeriods.reduce((s, ap) => s + num(ap.teamLeadBonusAmount), 0),
  });
  const profile = await gustoProfile(primary.agentName);
  const periodLabels = [...new Set(agentPeriods.map((ap) => ap.period.periodLabel))].sort();
  const periodLabel = periodLabels.join(", ");
  const uniqueRates = [...new Set(passed.map((s) => s.tierRate))];
  const tierRate = uniqueRates.length === 1 ? uniqueRates[0]! : calc?.tierRate ?? 0;

  return {
    agentPeriodId: primary.id,
    periodId: primary.period.id,
    periodLabel,
    periodLabels,
    agentName: primary.agentName,
    units,
    enrolledDebt,
    tierLabel: lastCheckTierLabel({
      agentName: primary.agentName,
      unitsCleared: units,
      result: calc,
    }),
    tierRate,
    grossCommission,
    clawbackAmount,
    gustoAmount,
    notes:
      units < 1
        ? "No upcoming files have passed the payment threshold yet. Remaining commission files are not paid."
        : "Last check pays threshold-passed files only. Remaining commission files that have not hit threshold are not paid.",
    gustoFirstName: profile.gustoFirstName,
    gustoLastName: profile.gustoLastName,
    gustoEmployeeId: profile.gustoEmployeeId,
    employmentType: profile.employmentType,
    companyName: profile.companyName,
    files,
    clawbacks,
  };
}

export async function loadLastCheckPreview(
  agentPeriodId: string,
): Promise<LastCheckPreview | null> {
  const view = await loadLastCheck(agentPeriodId);
  if (!view) return null;
  return {
    agentPeriodId: view.agentPeriodId,
    periodLabel: view.periodLabel,
    agentName: view.agentName,
    units: view.units,
    enrolledDebt: view.enrolledDebt,
    tierLabel: view.tierLabel,
    tierRate: view.tierRate,
    grossCommission: view.grossCommission,
    clawbackAmount: view.clawbackAmount,
    gustoAmount: view.gustoAmount,
  };
}

export async function resolveLastCheckAgentPeriodId(
  agentName: string,
): Promise<string | null> {
  const key = dismissalKey(agentName);
  const names = await siblingAgentNames(agentName);
  const upcoming = await upcomingUnpaidCalculatedPeriods();
  if (!upcoming.length) return null;
  const rows = await prisma.agentPeriod.findMany({
    where: {
      periodId: { in: upcoming.map((p) => p.id) },
      OR: names.map((n) => ({
        agentName: { equals: n, mode: "insensitive" as const },
      })),
    },
    orderBy: { period: { periodLabel: "desc" } },
    select: { id: true, agentName: true },
  });
  return rows.find((r) => dismissalKey(r.agentName) === key)?.id ?? rows[0]?.id ?? null;
}

export async function buildLastCheckFilesWorkbook(view: LastCheckView): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  const info = wb.addWorksheet("Agent");
  info.addRow(["Sales rep", view.agentName]);
  info.addRow(["Upcoming periods", view.periodLabel]);
  info.addRow(["Gusto first name", view.gustoFirstName || ""]);
  info.addRow(["Gusto last name", view.gustoLastName || ""]);
  info.addRow(["Gusto employee ID", view.gustoEmployeeId || ""]);
  info.addRow(["Employment", view.employmentType || ""]);
  info.addRow(["Company", view.companyName || ""]);
  info.addRow(["Files (threshold passed)", view.units]);
  info.addRow(["Enrolled debt", view.enrolledDebt]);
  info.addRow(["Tier", view.tierLabel]);
  info.addRow(["Rate", view.tierRate]);
  info.addRow(["Commission", view.grossCommission]);
  info.addRow(["Clawbacks", view.clawbackAmount]);
  info.addRow(["Gusto amount", view.gustoAmount]);
  info.getColumn(1).width = 24;
  info.getColumn(2).width = 28;

  const files = wb.addWorksheet("Files");
  files.addRow([
    "Period",
    "External ID",
    "Client",
    "Enrolled debt",
    "Commission",
    "Payments made",
    "Payments needed",
    "Pay freq",
    "1st clear",
    "2nd clear",
    "Dropped",
    "Kind",
  ]);
  files.getRow(1).font = { bold: true };
  for (const f of view.files) {
    files.addRow([
      f.periodLabel,
      f.externalId || f.crmId,
      f.clientName || "",
      f.enrolledDebt,
      f.commission,
      f.paymentsMade,
      f.paymentsNeeded,
      f.payFreq || "",
      f.firstPaymentClearedDate || "",
      f.secondPaymentClearedDate || "",
      f.droppedDate || "",
      f.kind,
    ]);
  }
  files.columns.forEach((c) => {
    c.width = 18;
  });

  const claws = wb.addWorksheet("Clawbacks");
  claws.addRow([
    "Period",
    "External ID",
    "Client",
    "Enrolled debt",
    "Clawback",
    "Pay freq",
    "Payments made",
    "1st clear",
    "Dropped",
    "Kind",
  ]);
  claws.getRow(1).font = { bold: true };
  for (const c of view.clawbacks) {
    claws.addRow([
      c.periodLabel,
      c.externalId || c.crmId,
      c.clientName || "",
      c.enrolledDebt,
      c.clawbackAmount,
      c.payFreq || "",
      c.paymentsMade,
      c.firstPaymentClearedDate || "",
      c.droppedDate || "",
      c.kind,
    ]);
  }
  claws.columns.forEach((col) => {
    col.width = 18;
  });

  const safe = `${view.agentName}-${view.periodLabels.join("_")}`.replace(/[^\w.\-]+/g, "_");
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `last-check-${safe}.xlsx`,
  };
}

export type LastPayRow = {
  agentPeriodId: string;
  periodId: string;
  periodLabel: string;
  source: "history" | "calculated";
  unitsCleared: number;
  grossCommission: number;
  clawbackAmount: number;
  netCommission: number;
  href: string;
};

function nameOrFilter(names: string[]) {
  return {
    OR: names.map((n) => ({
      agentName: { equals: n, mode: "insensitive" as const },
    })),
  };
}

export async function loadLastPays(agentName: string): Promise<LastPayRow[]> {
  const names = await siblingAgentNames(agentName);
  const upcoming = await upcomingUnpaidCalculatedPeriods();
  const upcomingLabels = new Set(upcoming.map((p) => p.periodLabel));

  const history = await prisma.agentPeriod.findMany({
    where: {
      period: { source: PeriodSource.history },
      ...nameOrFilter(names),
    },
    include: { period: { select: { id: true, periodLabel: true } } },
    orderBy: { period: { periodLabel: "desc" } },
  });
  if (history.length) {
    return history.map((row) => ({
      agentPeriodId: row.id,
      periodId: row.period.id,
      periodLabel: row.period.periodLabel,
      source: "history" as const,
      unitsCleared: row.unitsCleared,
      grossCommission: num(row.grossCommission),
      clawbackAmount: num(row.clawbackAmount),
      netCommission: num(row.netCommission),
      href: `/admin/history/${row.period.id}/agent/${row.id}`,
    }));
  }

  const calculated = await prisma.agentPeriod.findMany({
    where: {
      period: { source: PeriodSource.calculated },
      ...nameOrFilter(names),
    },
    include: { period: { select: { id: true, periodLabel: true } } },
    orderBy: { period: { periodLabel: "desc" } },
  });
  return calculated
    .filter((row) => !upcomingLabels.has(row.period.periodLabel))
    .map((row) => ({
      agentPeriodId: row.id,
      periodId: row.period.id,
      periodLabel: row.period.periodLabel,
      source: "calculated" as const,
      unitsCleared: row.unitsCleared,
      grossCommission: num(row.grossCommission),
      clawbackAmount: num(row.clawbackAmount),
      netCommission: num(row.netCommission),
      href: `/admin/periods/${row.period.id}`,
    }));
}

export async function buildLastPaysWorkbook(opts: {
  agentName: string;
  rows: LastPayRow[];
}): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  const sheet = wb.addWorksheet("Last pays");
  sheet.addRow([
    "Period",
    "Source",
    "Units",
    "Gross",
    "Clawbacks",
    "Net",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const row of opts.rows) {
    sheet.addRow([
      row.periodLabel,
      row.source === "history" ? "Logged as paid" : "Calculated",
      row.unitsCleared,
      row.grossCommission,
      row.clawbackAmount,
      row.netCommission,
    ]);
  }
  sheet.columns.forEach((c) => {
    c.width = 18;
  });
  const safe = opts.agentName.replace(/[^\w.\-]+/g, "_");
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `last-pays-${safe}.xlsx`,
  };
}
