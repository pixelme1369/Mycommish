import { isPeriodClosedByPayday } from "@/lib/commission/calculator";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type OpenPeriodRef = { id: string; periodLabel: string };

/** Units/gross must not be rewritten. Clawbacks may still land (owner policy). */
export function isCalculatedPeriodLocked(opts: {
  status: PeriodStatus | string;
  periodLabel: string;
  hasHistory?: boolean;
  asOf?: Date;
}): boolean {
  if (opts.status === PeriodStatus.closed || opts.status === "closed") return true;
  if (opts.hasHistory) return true;
  return isPeriodClosedByPayday(opts.periodLabel, opts.asOf ?? new Date());
}

/**
 * Persist Closed on calculated months that are payday-locked or already logged as paid.
 * Returns months that are still rewriteable (open, not paid, before payday).
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
        periodLabel: p.periodLabel,
        hasHistory: historyLabels.has(p.periodLabel),
        asOf,
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
