/**
 * Wipe period money rows only.
 * Durable ops logs stay unless explicitly cleared elsewhere:
 * statements, manual bonuses, advances, manager reimbursements, accepted file claims.
 */

import { prisma } from "@/lib/db";
import { isPeriodClosedByPayday } from "@/lib/commission/calculator";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";

export async function deletePeriodsByIds(periodIds: string[]) {
  if (!periodIds.length) return;

  // Detach advances first so ledger/period deletes never remove the durable rows.
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
  await prisma.commissionPeriod.deleteMany({ where: { id: { in: periodIds } } });
}

/**
 * Drop rewriteable calculated months so a new CRM export can rebuild units/gross.
 * Closed (status or payday lock) and history periods are never touched.
 */
export async function deleteOpenCalculatedPeriods(
  asOf: Date = new Date(),
): Promise<string[]> {
  const open = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated, status: PeriodStatus.open },
    select: { id: true, periodLabel: true },
  });
  const toDelete = open.filter((p) => !isPeriodClosedByPayday(p.periodLabel, asOf));
  await deletePeriodsByIds(toDelete.map((p) => p.id));
  return [...new Set(toDelete.map((p) => p.periodLabel))].sort();
}
