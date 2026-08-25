/**
 * One-shot: recalculate Artin Namjoo's open calculated AgentPeriods
 * onto his grandfathered tier ladder without re-uploading CRM.
 *
 * Updates: tier fields, gross, per-client commissionOnClient, commission_credit ledger, net.
 * Leaves clawback/bonus/advance ledger amounts as-is (re-summed into net).
 *
 * Usage: npx tsx scripts/refresh-artin-legacy-tiers.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient, LedgerType, PeriodSource, PeriodStatus, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calculateAgentCommission } from "../src/lib/commission/calculator";
import { computeNetCommission } from "../src/lib/commission/net";
import {
  commissionOnClientFor,
  countsTowardUnits,
} from "../src/lib/claims/accept-reassign";

const AGENT = "Artin Namjoo";
const dryRun = process.argv.includes("--dry-run");

function dec(n: number) {
  return new Prisma.Decimal(n);
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const rows = await prisma.agentPeriod.findMany({
    where: {
      agentName: { equals: AGENT, mode: "insensitive" },
      period: {
        source: PeriodSource.calculated,
        status: PeriodStatus.open,
      },
    },
    include: {
      period: { select: { periodLabel: true, status: true, source: true } },
    },
    orderBy: { period: { periodLabel: "asc" } },
  });

  if (!rows.length) {
    console.log(`No open calculated AgentPeriods for ${AGENT}.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Refreshing ${rows.length} open period(s) for ${AGENT}:\n`);

  for (const ap of rows) {
    const cancelPct = Number(ap.cancellationRate);
    const units = ap.unitsCleared;
    const debt = Number(ap.totalClearedDebt);

    const calc =
      units > 0
        ? calculateAgentCommission({
            agentName: ap.agentName,
            unitsCleared: units,
            totalClearedDebt: debt,
            cancellationRatePct: cancelPct,
          })
        : null;

    const newRate = calc?.tierRate ?? 0;
    const newGross = Math.round((calc?.grossCommission ?? 0) * 100) / 100;
    const oldRate = Number(ap.tierRate);
    const oldGross = Number(ap.grossCommission);

    console.log(
      `  ${ap.period.periodLabel}: units=${units} debt=$${debt.toFixed(2)}` +
        `\n    before: tier ${ap.rawTier}/${ap.adjustedTier} @ ${(oldRate * 100).toFixed(2)}% gross=$${oldGross.toFixed(2)}` +
        `\n    after:  tier ${calc?.rawTier ?? 0}/${calc?.adjustedTier ?? 0} @ ${(newRate * 100).toFixed(2)}% gross=$${newGross.toFixed(2)}` +
        `\n    delta gross: $${(newGross - oldGross).toFixed(2)}`,
    );

    if (dryRun) continue;
    if (!calc) {
      console.log("    skip (0 units)\n");
      continue;
    }
    if (Math.abs(newGross - oldGross) < 0.005 && Math.abs(newRate - oldRate) < 1e-9) {
      console.log("    already on correct ladder — skip\n");
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const events = await tx.clientEvent.findMany({ where: { agentPeriodId: ap.id } });
      for (const e of events) {
        if (!countsTowardUnits(e.kind, e.isLowCredit)) continue;
        const amount = commissionOnClientFor(
          {
            kind: e.kind,
            isLowCredit: e.isLowCredit,
            enrolledDebt: Number(e.enrolledDebt),
          },
          calc.tierRate,
        );
        if (Number(e.commissionOnClient) !== amount) {
          await tx.clientEvent.update({
            where: { id: e.id },
            data: { commissionOnClient: dec(amount) },
          });
        }
      }

      const credits = await tx.ledgerEntry.findMany({
        where: {
          agentPeriodId: ap.id,
          type: LedgerType.commission_credit,
          reversesEntryId: null,
        },
        include: { reversedBy: true },
      });
      for (const c of credits.filter((x) => !x.reversedBy)) {
        await tx.ledgerEntry.create({
          data: {
            type: LedgerType.reversal,
            amount: c.amount,
            agentName: ap.agentName,
            periodId: ap.periodId,
            agentPeriodId: ap.id,
            reasonCode: "artin_legacy_tier_refresh_reversal",
            note: "Refresh Artin grandfathered ladder",
            reversesEntryId: c.id,
          },
        });
      }
      if (newGross > 0) {
        await tx.ledgerEntry.create({
          data: {
            type: LedgerType.commission_credit,
            amount: dec(newGross),
            agentName: ap.agentName,
            periodId: ap.periodId,
            agentPeriodId: ap.id,
            reasonCode: "artin_legacy_tier_refresh_credit",
            note: "Refresh Artin grandfathered ladder",
          },
        });
      }

      async function sumTypes(types: LedgerType[]) {
        const entries = await tx.ledgerEntry.findMany({
          where: { agentPeriodId: ap.id, type: { in: types }, reversesEntryId: null },
          include: { reversedBy: true },
        });
        return (
          Math.round(
            entries.filter((e) => !e.reversedBy).reduce((s, e) => s + Number(e.amount), 0) * 100,
          ) / 100
        );
      }

      const clawbackAmount = await sumTypes([
        LedgerType.clawback_crm,
        LedgerType.clawback_cordoba,
        LedgerType.clawback_history,
      ]);
      const manualBonusAmount = await sumTypes([LedgerType.manual_bonus]);
      const teamLeadBonusAmount = await sumTypes([LedgerType.team_lead_bonus]);
      const advancePaidAmount = await sumTypes([LedgerType.advance_paid]);
      const advanceRepayAmount = await sumTypes([LedgerType.advance_repay]);
      const netCommission = computeNetCommission(
        newGross,
        clawbackAmount,
        manualBonusAmount,
        advancePaidAmount,
        advanceRepayAmount,
        teamLeadBonusAmount,
      );

      const noteBit = "grandfathered ladder refresh";
      const notes = calc.notes.includes(noteBit)
        ? calc.notes
        : `${calc.notes} | ${noteBit}`;

      await tx.agentPeriod.update({
        where: { id: ap.id },
        data: {
          rawTier: calc.rawTier,
          adjustedTier: calc.adjustedTier,
          tierRate: dec(calc.tierRate),
          grossCommission: dec(newGross),
          clawbackAmount: dec(clawbackAmount),
          manualBonusAmount: dec(manualBonusAmount),
          teamLeadBonusAmount: dec(teamLeadBonusAmount),
          advancePaidAmount: dec(advancePaidAmount),
          advanceRepayAmount: dec(advanceRepayAmount),
          netCommission: dec(netCommission),
          payout: dec(netCommission),
          payoutType: calc.payoutType,
          qualityBonusEligible: calc.qualityBonusEligible,
          cancellationPenaltyApplied: calc.cancellationPenaltyApplied,
          notes,
        },
      });
    });

    console.log(`    updated net → check portal\n`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
