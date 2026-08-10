import { prisma } from "@/lib/db";
import { LedgerType, Prisma } from "@/generated/prisma/client";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

/**
 * Recompute AgentPeriod clawback/net from non-reversed clawback ledger rows.
 * Never rewrites units/gross/tier (lock-after-pay).
 */
export async function recomputeAgentPeriodClawbacks(
  agentPeriodId: string,
  noteToAppend?: string,
) {
  const ap = await prisma.agentPeriod.findUnique({ where: { id: agentPeriodId } });
  if (!ap) return;

  const clawEntries = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: {
        in: [LedgerType.clawback_crm, LedgerType.clawback_cordoba, LedgerType.clawback_history],
      },
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });

  const active = clawEntries.filter((e) => !e.reversedBy);
  const clawbackAmount = active.reduce((s, e) => s + Number(e.amount), 0);
  const gross = Number(ap.grossCommission);
  const netCommission = Math.max(0, Math.round((gross - clawbackAmount) * 100) / 100);

  let notes = ap.notes || "";
  if (noteToAppend) {
    notes = notes ? `${notes} | ${noteToAppend}` : noteToAppend;
  }

  await prisma.agentPeriod.update({
    where: { id: agentPeriodId },
    data: {
      clawbackAmount: dec(Math.round(clawbackAmount * 100) / 100),
      netCommission: dec(netCommission),
      payout: dec(netCommission),
      notes: notes || null,
    },
  });
}
