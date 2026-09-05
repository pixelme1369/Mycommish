/**
 * Wipe period money rows only.
 * Durable ops logs stay unless explicitly cleared elsewhere:
 * statements, manual bonuses, advances, manager reimbursements, accepted file claims.
 */

import { prisma } from "@/lib/db";
import { persistCalculatedPeriodLocks, type OpenPeriodRef } from "@/lib/ingest/period-lock";

export type { OpenPeriodRef };

/** Detach advances + delete ledger/events/agent rows. Keeps CommissionPeriod. */
export async function clearPeriodContents(periodIds: string[]) {
  if (!periodIds.length) return;

  const linkedAdvances = await prisma.commissionAdvance.findMany({
    where: {
      OR: [
        { payAgentPeriod: { periodId: { in: periodIds } } },
        { repayAgentPeriod: { periodId: { in: periodIds } } },
        { payLedgerEntry: { periodId: { in: periodIds } } },
        { repayLedgerEntry: { periodId: { in: periodIds } } },
      ],
    },
    select: { id: true },
  });
  if (linkedAdvances.length) {
    await prisma.commissionAdvance.updateMany({
      where: { id: { in: linkedAdvances.map((a) => a.id) } },
      data: {
        payAgentPeriodId: null,
        repayAgentPeriodId: null,
        payLedgerEntryId: null,
        repayLedgerEntryId: null,
      },
    });
  }

  await prisma.ledgerEntry.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.clientEvent.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.agentPeriod.deleteMany({ where: { periodId: { in: periodIds } } });
}

export async function deletePeriodsByIds(periodIds: string[]) {
  if (!periodIds.length) return;
  await clearPeriodContents(periodIds);
  await prisma.commissionPeriod.deleteMany({ where: { id: { in: periodIds } } });
}

/**
 * Empty rewriteable calculated months so a new CRM export can rebuild units/gross
 * on the same period ids (admin/portal links keep working).
 * Closed and History-paid (Log as paid) periods are never touched.
 */
export async function clearOpenCalculatedPeriods(
  asOf: Date = new Date(),
): Promise<OpenPeriodRef[]> {
  const rewriteable = await persistCalculatedPeriodLocks(asOf);
  await clearPeriodContents(rewriteable.map((p) => p.id));
  return rewriteable;
}
