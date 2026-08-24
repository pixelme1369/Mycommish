import { prisma } from "@/lib/db";
import { LedgerType, Prisma } from "@/generated/prisma/client";
import { computeNetCommission } from "@/lib/commission/net";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

async function sumActiveLedger(
  agentPeriodId: string,
  types: LedgerType[],
): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: { in: types },
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  return entries
    .filter((e) => !e.reversedBy)
    .reduce((s, e) => s + Number(e.amount), 0);
}

/**
 * Recompute AgentPeriod clawback / bonus / advance / net from non-reversed ledger rows.
 * Never rewrites units/gross/tier (lock-after-pay).
 */
export async function recomputeAgentPeriodClawbacks(
  agentPeriodId: string,
  noteToAppend?: string,
) {
  const ap = await prisma.agentPeriod.findUnique({ where: { id: agentPeriodId } });
  if (!ap) return;

  const clawbackAmount = await sumActiveLedger(agentPeriodId, [
    LedgerType.clawback_crm,
    LedgerType.clawback_cordoba,
    LedgerType.clawback_history,
  ]);
  const manualBonusAmount = await sumActiveLedger(agentPeriodId, [
    LedgerType.manual_bonus,
  ]);
  const advancePaidAmount = await sumActiveLedger(agentPeriodId, [
    LedgerType.advance_paid,
  ]);
  const advanceRepayAmount = await sumActiveLedger(agentPeriodId, [
    LedgerType.advance_repay,
  ]);
  const gross = Number(ap.grossCommission);
  const netCommission = computeNetCommission(
    gross,
    clawbackAmount,
    manualBonusAmount,
    advancePaidAmount,
    advanceRepayAmount,
  );

  let notes = ap.notes || "";
  if (noteToAppend) {
    notes = notes ? `${notes} | ${noteToAppend}` : noteToAppend;
  }

  await prisma.agentPeriod.update({
    where: { id: agentPeriodId },
    data: {
      clawbackAmount: dec(Math.round(clawbackAmount * 100) / 100),
      manualBonusAmount: dec(Math.round(manualBonusAmount * 100) / 100),
      advancePaidAmount: dec(Math.round(advancePaidAmount * 100) / 100),
      advanceRepayAmount: dec(Math.round(advanceRepayAmount * 100) / 100),
      netCommission: dec(netCommission),
      payout: dec(netCommission),
      notes: notes || null,
    },
  });
}
