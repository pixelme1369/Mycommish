import { prisma } from "@/lib/db";
import { PeriodSource, Prisma } from "@/generated/prisma/client";
import {
  listOpenerPlanAgents,
  listOpenerTransferAgentIdByName,
  isOpenerPlanAgentId,
} from "@/lib/agents/opener";
import { openerIdForTransferAgent } from "@/lib/agents/opener-match";
import {
  openerPayoutForDebt,
  openerPeriodFromYmd,
  openerSnapshotFromForth,
  openerCommissionForPayStatus,
  previousOpenerMonthLabel,
  OPENER_MIN_PERIOD_LABEL,
  type OpenerForthSnapshot,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { pacificTodayYmd, pacificYmdFromInstant } from "@/lib/portal/daily-tasks-dates";
import {
  addOpenerLogToCounts,
  emptyOpenerLogCounts,
  parseOpenerMoneyInput,
  sanitizeOpenerNotes,
} from "@/lib/opener/summary";

const openerForthSelect = {
  forthId: true,
  tpId: true,
  enrolledAmount: true,
  stageTitle: true,
  status: true,
  transferAgent: true,
  transferredDate: true,
} as const;

/**
 * Openers often paste Cordoba / ADP External ID (`tpId`), not Forth contact `id`.
 * Resolve either so CRM stage/status/debt can hydrate the transfer log.
 */
export async function findForthContactForOpenerId(fileId: string) {
  const id = fileId.trim();
  if (!id) return null;
  return prisma.forthContact.findFirst({
    where: { OR: [{ forthId: id }, { tpId: id }] },
    select: openerForthSelect,
  });
}

export async function lookupForthForOpener(
  forthId: string,
): Promise<OpenerForthSnapshot> {
  const contact = await findForthContactForOpenerId(forthId);
  return openerSnapshotFromForth(contact);
}

export async function existingOpenerLog(forthId: string) {
  const id = forthId.trim();
  const contact = await findForthContactForOpenerId(id);
  const ids = [...new Set([id, contact?.forthId, contact?.tpId].filter(Boolean))] as string[];
  return prisma.openerTransferLog.findFirst({
    where: { forthId: { in: ids } },
    select: {
      id: true,
      agentId: true,
      agent: { select: { displayName: true } },
    },
  });
}

/**
 * Auto-create opener transfer logs from Neon ForthContact rows that have
 * Transfer Agent + Transferred Date. Debt/stage/status come from the contact.
 */
export async function ensureOpenerTransferLogsFromForth(opts?: {
  agentId?: string;
}): Promise<{
  considered: number;
  created: number;
  skippedExisting: number;
  skippedNoMatch: number;
  skippedNoDate: number;
  skippedDebt: number;
  skippedLocked: number;
}> {
  const byName = await listOpenerTransferAgentIdByName();
  if (!byName.size) {
    return {
      considered: 0,
      created: 0,
      skippedExisting: 0,
      skippedNoMatch: 0,
      skippedNoDate: 0,
      skippedDebt: 0,
      skippedLocked: 0,
    };
  }

  const onlyAgentId = opts?.agentId?.trim() || null;
  const contacts = await prisma.forthContact.findMany({
    where: {
      transferAgent: { not: null },
      transferredDate: { not: null },
    },
    select: openerForthSelect,
  });

  const existingLogs = await prisma.openerTransferLog.findMany({
    select: { forthId: true },
  });
  const existingIds = new Set(existingLogs.map((l) => l.forthId));

  const { openerMonthLockedSet } = await import("@/lib/opener/period");
  const monthCandidates = [
    ...new Set(
      contacts
        .map((c) => (c.transferredDate ? pacificYmdFromInstant(c.transferredDate).slice(0, 7) : ""))
        .filter((m) => /^\d{4}-\d{2}$/.test(m) && m >= OPENER_MIN_PERIOD_LABEL),
    ),
  ];
  const lockedMonths = await openerMonthLockedSet(monthCandidates);

  let created = 0;
  let skippedExisting = 0;
  let skippedNoMatch = 0;
  let skippedNoDate = 0;
  let skippedDebt = 0;
  let skippedLocked = 0;
  let considered = 0;

  for (const c of contacts) {
    const agentId = openerIdForTransferAgent(c.transferAgent, byName);
    if (!agentId) {
      skippedNoMatch += 1;
      continue;
    }
    if (onlyAgentId && agentId !== onlyAgentId) continue;
    considered += 1;
    if (existingIds.has(c.forthId) || (c.tpId && existingIds.has(c.tpId))) {
      skippedExisting += 1;
      continue;
    }
    if (!c.transferredDate) {
      skippedNoDate += 1;
      continue;
    }
    const transferYmd = pacificYmdFromInstant(c.transferredDate);
    const monthLabel = transferYmd.slice(0, 7);
    if (monthLabel < OPENER_MIN_PERIOD_LABEL) {
      skippedLocked += 1;
      continue;
    }
    if (lockedMonths.has(monthLabel)) {
      skippedLocked += 1;
      continue;
    }
    const snap = openerSnapshotFromForth(c);
    if (!snap.unmatched && openerPayoutForDebt(snap.debtLoad) == null) {
      skippedDebt += 1;
      continue;
    }

    await prisma.openerTransferLog.create({
      data: {
        agentId,
        forthId: c.forthId,
        transferYmd,
        debtLoad: snap.debtLoad,
        stageTitle: snap.stageTitle,
        status: snap.status,
        commission: snap.commission,
        payStatus: snap.payStatus,
        unmatched: snap.unmatched,
      },
    });
    existingIds.add(c.forthId);
    if (c.tpId) existingIds.add(c.tpId);
    created += 1;
  }

  return {
    considered,
    created,
    skippedExisting,
    skippedNoMatch,
    skippedNoDate,
    skippedDebt,
    skippedLocked,
  };
}

export async function refreshOpenerTransferLogs(opts?: {
  agentId?: string;
  monthLabel?: string;
}): Promise<{
  checked: number;
  updated: number;
}> {
  const agentId = opts?.agentId?.trim();
  const monthLabel =
    opts?.monthLabel && /^\d{4}-\d{2}$/.test(opts.monthLabel) ? opts.monthLabel : undefined;

  const logs = await prisma.openerTransferLog.findMany({
    where: {
      ...(agentId ? { agentId } : {}),
      ...(monthLabel ? { transferYmd: { startsWith: monthLabel } } : {}),
    },
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

  const logIds = logs.map((l) => l.forthId);
  const contacts = await prisma.forthContact.findMany({
    where: {
      OR: [{ forthId: { in: logIds } }, { tpId: { in: logIds } }],
    },
    select: openerForthSelect,
  });
  /** Index by Forth id and Cordoba/tp id so either File ID resolves. */
  const byId = new Map<string, (typeof contacts)[number]>();
  for (const c of contacts) {
    byId.set(c.forthId, c);
    if (c.tpId?.trim()) byId.set(c.tpId.trim(), c);
  }

  let updated = 0;
  for (const row of logs) {
    const contact = byId.get(row.forthId) ?? null;
    const snap = openerSnapshotFromForth(contact);
    const locked = lockedMonths.has(row.transferYmd.slice(0, 7));
    const nextPay = locked
      ? row.payStatus
      : row.payStatusOverridden
        ? row.payStatus
        : snap.payStatus;
    const nextDebt = locked ? Number(row.debtLoad) : snap.debtLoad;
    const nextCommission = locked
      ? Number(row.commission)
      : openerCommissionForPayStatus(nextDebt, nextPay);
    let nextYmd = row.transferYmd;
    if (!locked && contact?.transferredDate) {
      const fromCrm = pacificYmdFromInstant(contact.transferredDate);
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(fromCrm) &&
        fromCrm.slice(0, 7) >= OPENER_MIN_PERIOD_LABEL &&
        !lockedMonths.has(fromCrm.slice(0, 7))
      ) {
        nextYmd = fromCrm;
      }
    }
    const same =
      Number(row.debtLoad) === nextDebt &&
      (row.stageTitle || null) === snap.stageTitle &&
      (row.status || null) === snap.status &&
      Number(row.commission) === nextCommission &&
      row.payStatus === nextPay &&
      row.unmatched === snap.unmatched &&
      row.transferYmd === nextYmd;
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
        transferYmd: nextYmd,
      },
    });
    updated += 1;
  }

  return { checked: logs.length, updated };
}

/** Write $0 on excluded files so lock/pay snapshots do not freeze a band amount. */
export async function syncOpenerLogCommissions(
  monthLabel: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) return 0;
  const logs = await db.openerTransferLog.findMany({
    where: { transferYmd: { startsWith: monthLabel } },
    select: { id: true, debtLoad: true, payStatus: true, commission: true },
  });
  let updated = 0;
  for (const row of logs) {
    const commission = openerCommissionForPayStatus(
      Number(row.debtLoad),
      row.payStatus as OpenerPayStatusName,
    );
    if (Number(row.commission) === commission) continue;
    await db.openerTransferLog.update({
      where: { id: row.id },
      data: { commission },
    });
    updated += 1;
  }
  return updated;
}

export async function listOpenerLogsForAgent(agentId: string, monthLabel?: string) {
  const month =
    monthLabel && /^\d{4}-\d{2}$/.test(monthLabel) ? monthLabel : undefined;
  const { isOpenerMonthLocked } = await import("@/lib/opener/period");
  const locked = month ? await isOpenerMonthLocked(month) : false;
  if (!locked) {
    // Keep CRM status/debt/date fresh whenever the opener opens an unlocked view.
    await ensureOpenerTransferLogsFromForth({ agentId });
    await refreshOpenerTransferLogs({
      agentId,
      ...(month ? { monthLabel: month } : {}),
    });
    if (month) await syncOpenerLogCommissions(month);
  }
  return prisma.openerTransferLog.findMany({
    where: {
      agentId,
      ...(month
        ? { transferYmd: { startsWith: month } }
        : { transferYmd: { gte: `${OPENER_MIN_PERIOD_LABEL}-01` } }),
    },
    orderBy: [{ transferYmd: "desc" }, { createdAt: "desc" }],
  });
}

export async function listAllOpenerTransferLogs(monthLabel?: string) {
  if (monthLabel && /^\d{4}-\d{2}$/.test(monthLabel)) {
    const { isOpenerMonthLocked } = await import("@/lib/opener/period");
    if (!(await isOpenerMonthLocked(monthLabel))) {
      await ensureOpenerTransferLogsFromForth();
      await refreshOpenerTransferLogs({ monthLabel });
      await syncOpenerLogCommissions(monthLabel);
    }
  }
  return prisma.openerTransferLog.findMany({
    where: monthLabel
      ? { transferYmd: { startsWith: monthLabel } }
      : { transferYmd: { gte: `${OPENER_MIN_PERIOD_LABEL}-01` } },
    include: { agent: { select: { displayName: true } } },
    orderBy: [{ transferYmd: "desc" }, { forthId: "asc" }],
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
    listOpenerPlanAgents(),
    prisma.openerTransferLog.findMany({
      where: month ? { transferYmd: { startsWith: month } } : undefined,
      select: {
        agentId: true,
        payStatus: true,
        debtLoad: true,
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
      commission: openerCommissionForPayStatus(
        Number(row.debtLoad),
        row.payStatus as OpenerPayStatusName,
      ),
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

  if (!(await isOpenerPlanAgentId(opts.agentId))) {
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

/** Pay periods openers can switch between — Aug 2026 onward only. */
export async function listOpenerPayPeriodLabels(): Promise<string[]> {
  const [calc, logs] = await Promise.all([
    prisma.commissionPeriod.findMany({
      where: { source: PeriodSource.calculated },
      select: { periodLabel: true },
      orderBy: { periodLabel: "desc" },
    }),
    prisma.openerTransferLog.findMany({
      where: { transferYmd: { gte: `${OPENER_MIN_PERIOD_LABEL}-01` } },
      select: { transferYmd: true },
    }),
  ]);
  const set = new Set<string>();
  for (const p of calc) {
    if (p.periodLabel && p.periodLabel >= OPENER_MIN_PERIOD_LABEL) {
      set.add(p.periodLabel);
    }
  }
  for (const l of logs) {
    const m = openerPeriodFromYmd(l.transferYmd);
    if (/^\d{4}-\d{2}$/.test(m) && m >= OPENER_MIN_PERIOD_LABEL) set.add(m);
  }
  const current = openerPeriodFromYmd(pacificTodayYmd());
  const previous = previousOpenerMonthLabel(current);
  if (/^\d{4}-\d{2}$/.test(current) && current >= OPENER_MIN_PERIOD_LABEL) {
    set.add(current);
  }
  if (/^\d{4}-\d{2}$/.test(previous) && previous >= OPENER_MIN_PERIOD_LABEL) {
    set.add(previous);
  }
  // Always offer the opener program start month even before calc periods exist.
  set.add(OPENER_MIN_PERIOD_LABEL);
  return [...set].sort().reverse();
}

export async function defaultOpenerPeriodLabel(
  requested?: string,
): Promise<string> {
  const labels = await listOpenerPayPeriodLabels();
  if (
    requested &&
    /^\d{4}-\d{2}$/.test(requested) &&
    requested >= OPENER_MIN_PERIOD_LABEL &&
    labels.includes(requested)
  ) {
    return requested;
  }
  const previous = previousOpenerMonthLabel(openerPeriodFromYmd(pacificTodayYmd()));
  if (previous >= OPENER_MIN_PERIOD_LABEL && labels.includes(previous)) {
    return previous;
  }
  return labels[0] || OPENER_MIN_PERIOD_LABEL;
}

/** Used only to keep TS aware openerPayoutForDebt is the gate on matched creates. */
export function matchedDebtTooLow(snap: OpenerForthSnapshot): boolean {
  return !snap.unmatched && openerPayoutForDebt(snap.debtLoad) == null;
}
