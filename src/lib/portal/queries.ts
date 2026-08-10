import { prisma } from "@/lib/db";
import { PeriodSource, ClientEventKind } from "@/generated/prisma/client";

export const LATEST_PERIODS_SHOWN = 2;

export async function latestCalculatedPeriods(limit = LATEST_PERIODS_SHOWN) {
  return prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    orderBy: { periodLabel: "desc" },
    take: limit,
  });
}

/** Agent names that appear in the latest-2 calculated window only. */
export async function listAgentNamesInLatestPeriods() {
  const periods = await latestCalculatedPeriods();
  if (!periods.length) return [] as string[];

  const names = await prisma.agentPeriod.findMany({
    where: { periodId: { in: periods.map((p) => p.id) } },
    select: { agentName: true },
    distinct: ["agentName"],
    orderBy: { agentName: "asc" },
  });
  return names.map((n) => n.agentName);
}


export async function agentRowsForLatestPeriods(agentName: string) {
  const periods = await latestCalculatedPeriods();
  if (!periods.length) return { periods, rows: [] as Awaited<ReturnType<typeof fetchRows>> };

  const rows = await fetchRows(
    agentName,
    periods.map((p) => p.id),
  );
  // Keep period order (newest first); omit months where this agent has no row.
  const byPeriodId = new Map(rows.map((r) => [r.periodId, r]));
  const ordered = periods.map((p) => byPeriodId.get(p.id)).filter(Boolean) as typeof rows;
  return { periods, rows: ordered };
}

async function fetchRows(agentName: string, periodIds: string[]) {
  return prisma.agentPeriod.findMany({
    where: { agentName, periodId: { in: periodIds } },
    include: { period: true },
    orderBy: { period: { periodLabel: "desc" } },
  });
}

export async function getScopedAgentPeriod(periodId: string, agentPeriodId: string, agentName: string) {
  const latest = await latestCalculatedPeriods();
  const latestIds = new Set(latest.map((p) => p.id));
  if (!latestIds.has(periodId)) return null;

  const row = await prisma.agentPeriod.findFirst({
    where: { id: agentPeriodId, periodId, agentName },
    include: { period: true },
  });
  return row;
}

export async function getClientsForAgentPeriod(agentPeriodId: string) {
  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId },
    orderBy: [{ clientName: "asc" }, { crmId: "asc" }],
  });

  const clawbacks = events.filter(
    (e) =>
      e.clawbackApplied ||
      e.kind === ClientEventKind.clawback ||
      e.kind === ClientEventKind.cordoba_clawback,
  );
  const pending = events.filter((e) => e.kind === ClientEventKind.pending && !e.clawbackApplied);
  const cancelled = events.filter(
    (e) =>
      !e.clawbackApplied &&
      (e.kind === ClientEventKind.same_month_cancel || e.kind === ClientEventKind.safe_cancel),
  );
  const cleared = events.filter(
    (e) =>
      !e.clawbackApplied &&
      (e.kind === ClientEventKind.cleared ||
        e.kind === ClientEventKind.low_credit_cleared ||
        (e.isCleared && e.kind !== ClientEventKind.pending)),
  );

  // Avoid double-listing: if something landed in cleared via isCleared, don't also put in cancelled
  const clearedIds = new Set(cleared.map((e) => e.id));
  const cancelledOnly = cancelled.filter((e) => !clearedIds.has(e.id));
  const pendingOnly = pending.filter((e) => !clearedIds.has(e.id));

  return { cleared, clawbacks, pending: pendingOnly, cancelled: cancelledOnly, all: events };
}

/** Cordoba display flags for a set of crmIds (paid evidence + chargeback-seen badge). */
export async function getCordobaFlags(crmIds: string[]) {
  const ids = [...new Set(crmIds.filter(Boolean))];
  if (!ids.length) {
    return { paidIds: new Set<string>(), chargebackSeenIds: new Set<string>() };
  }
  const [paid, seen] = await Promise.all([
    prisma.cordobaPaid.findMany({
      where: { crmId: { in: ids } },
      select: { crmId: true },
    }),
    prisma.cordobaChargebackSeen.findMany({
      where: { crmId: { in: ids } },
      select: { crmId: true },
    }),
  ]);
  return {
    paidIds: new Set(paid.map((p) => p.crmId)),
    chargebackSeenIds: new Set(seen.map((s) => s.crmId)),
  };
}

export type MergedClawbackRow = {
  id: string;
  crmId: string;
  clientName: string | null;
  enrolledDebt: number | string | { toString(): string };
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  clawbackAmount: number;
  kind: string;
  isLowCredit: boolean;
  /** True when Cordoba Chargebacks tab also lists this client (snapshot or seen). */
  cordobaChargeBack: boolean;
  /** True when this is a $0 Cordoba-only reconciliation row (not deducted yet). */
  cordobaOnly: boolean;
};

/**
 * Merge real clawback ClientEvents with CordobaChargebackSnapshot rows for this
 * agent+period. Snapshot-only IDs show as $0 with Cordoba Charge back = Yes
 * (parity with old merge_clawback_with_cordoba_entries).
 */
export async function mergeClawbacksWithCordoba(
  agentName: string,
  periodLabel: string,
  clawbacks: Awaited<ReturnType<typeof getClientsForAgentPeriod>>["clawbacks"],
): Promise<MergedClawbackRow[]> {
  const snapshots = await prisma.cordobaChargebackSnapshot.findMany({
    where: { agentName, periodLabel },
    orderBy: { uploadedAt: "asc" },
  });
  const entryByCrmId = new Map(snapshots.map((s) => [s.crmId, s]));
  const matched = new Set<string>();
  const merged: MergedClawbackRow[] = [];

  for (const c of clawbacks) {
    if (c.crmId) matched.add(c.crmId);
    merged.push({
      id: c.id,
      crmId: c.crmId,
      clientName: c.clientName,
      enrolledDebt: c.enrolledDebt,
      firstPaymentClearedDate: c.firstPaymentClearedDate,
      droppedDate: c.droppedDate,
      clawbackAmount: Number(c.clawbackAmount),
      kind: c.kind,
      isLowCredit: c.isLowCredit,
      cordobaChargeBack: Boolean(c.crmId && entryByCrmId.has(c.crmId)),
      cordobaOnly: false,
    });
  }

  const orphanIds = [...entryByCrmId.keys()].filter((id) => !matched.has(id));
  const ownByCrmId = new Map<
    string,
    {
      clientName: string | null;
      enrolledDebt: MergedClawbackRow["enrolledDebt"];
      firstPaymentClearedDate: string | null;
      droppedDate: string | null;
      isLowCredit: boolean;
    }
  >();
  if (orphanIds.length) {
    const owns = await prisma.clientEvent.findMany({
      where: { crmId: { in: orphanIds } },
      orderBy: { id: "desc" },
      select: {
        crmId: true,
        clientName: true,
        enrolledDebt: true,
        firstPaymentClearedDate: true,
        droppedDate: true,
        isLowCredit: true,
      },
    });
    for (const o of owns) {
      if (!ownByCrmId.has(o.crmId)) ownByCrmId.set(o.crmId, o);
    }
  }

  for (const crmId of orphanIds) {
    const snap = entryByCrmId.get(crmId)!;
    const own = ownByCrmId.get(crmId);
    merged.push({
      id: `cordoba-only-${crmId}`,
      crmId,
      clientName: own?.clientName || snap.clientName,
      enrolledDebt: own?.enrolledDebt ?? 0,
      firstPaymentClearedDate:
        own?.firstPaymentClearedDate || snap.firstPaymentClearedDate,
      droppedDate: own?.droppedDate || null,
      clawbackAmount: 0,
      kind: "cordoba_flagged",
      isLowCredit: own?.isLowCredit ?? false,
      cordobaChargeBack: true,
      cordobaOnly: true,
    });
  }

  return merged;
}

export { money, ratePercent, cancelRatePercent } from "@/lib/format";
