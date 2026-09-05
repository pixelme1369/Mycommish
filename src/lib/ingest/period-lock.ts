import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type OpenPeriodRef = { id: string; periodLabel: string };

/** Units/gross lock only after Log as paid (or an already-closed status). */
export function isCalculatedPeriodLocked(opts: {
  status: PeriodStatus | string;
  hasHistory?: boolean;
}): boolean {
  if (opts.status === PeriodStatus.closed || opts.status === "closed") return true;
  return Boolean(opts.hasHistory);
}

/**
 * Persist Closed on calculated months that were logged as paid (History exists).
 * Returns months that are still rewriteable.
 */
export async function persistCalculatedPeriodLocks(
  asOf: Date = new Date(),
): Promise<OpenPeriodRef[]> {
  const [open, historyRows] = await Promise.all([
    prisma.commissionPeriod.findMany({
      where: { source: PeriodSource.calculated, status: PeriodStatus.open },
      select: { id: true, periodLabel: true },
    }),
    prisma.commissionPeriod.findMany({
      where: { source: PeriodSource.history },
      select: { periodLabel: true },
    }),
  ]);
  const historyLabels = new Set(historyRows.map((r) => r.periodLabel));
  const locked: OpenPeriodRef[] = [];
  const rewriteable: OpenPeriodRef[] = [];
  for (const p of open) {
    if (
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        hasHistory: historyLabels.has(p.periodLabel),
      })
    ) {
      locked.push(p);
    } else {
      rewriteable.push(p);
    }
  }
  if (locked.length) {
    await prisma.commissionPeriod.updateMany({
      where: { id: { in: locked.map((p) => p.id) } },
      data: { status: PeriodStatus.closed, closedAt: asOf },
    });
  }
  return rewriteable.sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
}
