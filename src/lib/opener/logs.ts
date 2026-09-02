import { prisma } from "@/lib/db";
import { AgentRole, PeriodSource, Prisma } from "@/generated/prisma/client";
import {
  openerPayoutForDebt,
  openerPeriodFromYmd,
  openerSnapshotFromForth,
  type OpenerForthSnapshot,
} from "@/lib/opener/payout";
import { pacificTodayYmd } from "@/lib/portal/daily-tasks-dates";
import {
  addOpenerLogToCounts,
  emptyOpenerLogCounts,
  parseOpenerMoneyInput,
  sanitizeOpenerNotes,
} from "@/lib/opener/summary";

export async function lookupForthForOpener(
  forthId: string,
): Promise<OpenerForthSnapshot> {
  const contact = await prisma.forthContact.findUnique({
    where: { forthId },
    select: {
      enrolledAmount: true,
      stageTitle: true,
      status: true,
    },
  });
  return openerSnapshotFromForth(contact);
}

export async function existingOpenerLog(forthId: string) {
  return prisma.openerTransferLog.findUnique({
    where: { forthId },
    select: {
      id: true,
      agentId: true,
      agent: { select: { displayName: true } },
    },
  });
}

export async function refreshOpenerTransferLogs(): Promise<{
  checked: number;
  updated: number;
}> {
  const logs = await prisma.openerTransferLog.findMany({
    select: {
      id: true,
      forthId: true,
      transferYmd: true,
      payStatusOverridden: true,
      debtLoad: true,
      stageTitle: true,
      status: true,
      commission: true,
      payStatus: true,
      unmatched: true,
    },
  });
  if (!logs.length) return { checked: 0, updated: 0 };

  const { openerMonthLockedSet } = await import("@/lib/opener/period");
  const lockedMonths = await openerMonthLockedSet(
    [...new Set(logs.map((l) => l.transferYmd.slice(0, 7)))],
  );

  const contacts = await prisma.forthContact.findMany({
    where: { forthId: { in: logs.map((l) => l.forthId) } },
    select: {
      forthId: true,
      enrolledAmount: true,
      stageTitle: true,
      status: true,
    },
  });
  const byId = new Map(contacts.map((c) => [c.forthId, c]));

  let updated = 0;
  for (const row of logs) {
    const snap = openerSnapshotFromForth(byId.get(row.forthId) ?? null);
    const locked = lockedMonths.has(row.transferYmd.slice(0, 7));
    const nextPay = locked
      ? row.payStatus
      : row.payStatusOverridden
        ? row.payStatus
        : snap.payStatus;
    const nextCommission = locked ? Number(row.commission) : snap.commission;
    const nextDebt = locked ? Number(row.debtLoad) : snap.debtLoad;
    const same =
      Number(row.debtLoad) === nextDebt &&
      (row.stageTitle || null) === snap.stageTitle &&
      (row.status || null) === snap.status &&
      Number(row.commission) === nextCommission &&
      row.payStatus === nextPay &&
      row.unmatched === snap.unmatched;
    if (same) continue;
    await prisma.openerTransferLog.update({
      where: { id: row.id },
      data: {
        debtLoad: nextDebt,
        stageTitle: snap.stageTitle,
        status: snap.status,
        commission: nextCommission,
        payStatus: nextPay,
        unmatched: snap.unmatched,
      },
    });
    updated += 1;
  }

  return { checked: logs.length, updated };
}

export async function listOpenerLogsForAgent(agentId: string, monthLabel?: string) {
  return prisma.openerTransferLog.findMany({
    where: {
      agentId,
      ...(monthLabel ? { transferYmd: { startsWith: monthLabel } } : {}),
    },
    orderBy: [{ transferYmd: "desc" }, { createdAt: "desc" }],
  });
}

export type OpenerSummaryRow = {
  agentId: string;
  displayName: string;
  approvedTransfers: number;
  commissionTotal: number;
  upscore: number;
  totalPayout: number;
  excludedCanceled: number;
  pendingCrmReview: number;
  logCount: number;
};

export async function listOpenerSummaries(
  monthLabel?: string,
): Promise<OpenerSummaryRow[]> {
  const month = monthLabel && /^\d{4}-\d{2}$/.test(monthLabel) ? monthLabel : undefined;
  const [openers, logs, upscores] = await Promise.all([
    prisma.agent.findMany({
      where: { role: AgentRole.opener },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.openerTransferLog.findMany({
      where: month ? { transferYmd: { startsWith: month } } : undefined,
      select: {
        agentId: true,
        payStatus: true,
        commission: true,
        unmatched: true,
        agent: { select: { displayName: true } },
      },
    }),
    month
      ? prisma.openerPeriodUpscore.findMany({
          where: { monthLabel: month },
          select: { agentId: true, amount: true },
        })
      : Promise.resolve([]),
  ]);

  const upscoreByAgent = new Map(
    upscores.map((u) => [u.agentId, Number(u.amount)]),
  );
  const map = new Map<string, OpenerSummaryRow>();
  for (const o of openers) {
    map.set(o.id, emptySummary(o.id, o.displayName, upscoreByAgent.get(o.id) ?? 0));
  }
  for (const row of logs) {
    const cur =
      map.get(row.agentId) ??
      emptySummary(
        row.agentId,
        row.agent.displayName,
        upscoreByAgent.get(row.agentId) ?? 0,
      );
    addOpenerLogToCounts(cur, {
      payStatus: row.payStatus,
      commission: Number(row.commission),
      unmatched: row.unmatched,
    });
    cur.totalPayout = cur.commissionTotal + cur.upscore;
    map.set(row.agentId, cur);
  }

  return [...map.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

function emptySummary(
  agentId: string,
  displayName: string,
  upscore: number,
): OpenerSummaryRow {
  return {
    agentId,
    displayName,
    ...emptyOpenerLogCounts(),
    upscore,
    totalPayout: upscore,
  };
}

export async function setOpenerUpscore(opts: {
  agentId: string;
  monthLabel: string;
  amountRaw: string;
  updatedById: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}$/.test(opts.monthLabel)) {
    return { ok: false, error: "Invalid pay period." };
  }
  const amount = parseOpenerMoneyInput(opts.amountRaw);
  if (amount == null) return { ok: false, error: "Enter a valid dollar amount." };
  if (amount > 100_000) return { ok: false, error: "Upscore is too large." };

  const agent = await prisma.agent.findUnique({
    where: { id: opts.agentId },
    select: { id: true, role: true },
  });
  if (!agent || agent.role !== AgentRole.opener) {
    return { ok: false, error: "Opener not found." };
  }

  await prisma.openerPeriodUpscore.upsert({
    where: {
      agentId_monthLabel: { agentId: opts.agentId, monthLabel: opts.monthLabel },
    },
    create: {
      agentId: opts.agentId,
      monthLabel: opts.monthLabel,
      amount: new Prisma.Decimal(amount),
      updatedById: opts.updatedById,
    },
    update: {
      amount: new Prisma.Decimal(amount),
      updatedById: opts.updatedById,
    },
  });
  return { ok: true };
}

export async function setOpenerLogNotes(opts: {
  id: string;
  notesRaw: string;
  agentId?: string;
}): Promise<{ ok: true; agentId: string } | { ok: false; error: string }> {
  const notes = sanitizeOpenerNotes(opts.notesRaw);
  const row = await prisma.openerTransferLog.findFirst({
    where: { id: opts.id, ...(opts.agentId ? { agentId: opts.agentId } : {}) },
    select: { id: true, agentId: true },
  });
  if (!row) return { ok: false, error: "Row not found." };
  await prisma.openerTransferLog.update({
    where: { id: row.id },
    data: { notes },
  });
  return { ok: true, agentId: row.agentId };
}

/** Pay periods openers can switch between — calculated CRM months plus any logged months. */
export async function listOpenerPayPeriodLabels(): Promise<string[]> {
  const [calc, logs] = await Promise.all([
    prisma.commissionPeriod.findMany({
      where: { source: PeriodSource.calculated },
      select: { periodLabel: true },
      orderBy: { periodLabel: "desc" },
    }),
    prisma.openerTransferLog.findMany({ select: { transferYmd: true } }),
  ]);
  const set = new Set<string>();
  for (const p of calc) {
    if (p.periodLabel) set.add(p.periodLabel);
  }
  for (const l of logs) {
    const m = openerPeriodFromYmd(l.transferYmd);
    if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
  }
  const current = openerPeriodFromYmd(pacificTodayYmd());
  if (/^\d{4}-\d{2}$/.test(current)) set.add(current);
  return [...set].sort().reverse();
}

export async function defaultOpenerPeriodLabel(
  requested?: string,
): Promise<string> {
  if (requested && /^\d{4}-\d{2}$/.test(requested)) return requested;
  const labels = await listOpenerPayPeriodLabels();
  return labels[0] || openerPeriodFromYmd(pacificTodayYmd());
}

/** Used only to keep TS aware openerPayoutForDebt is the gate on matched creates. */
export function matchedDebtTooLow(snap: OpenerForthSnapshot): boolean {
  return !snap.unmatched && openerPayoutForDebt(snap.debtLoad) == null;
}
