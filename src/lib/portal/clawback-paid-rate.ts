import { prisma } from "@/lib/db";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";
import {
  clawbackAmountFromPaidRate,
  parsePaidRatePercentInput,
} from "@/lib/portal/clawback-paid-rate-math";
import { LedgerType, Prisma } from "@/generated/prisma/client";

export {
  clawbackAmountFromPaidRate,
  parsePaidRatePercentInput,
} from "@/lib/portal/clawback-paid-rate-math";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export type SetClawbackPaidRateResult =
  | {
      ok: true;
      paidRate: number;
      clawbackAmount: number;
      message: string;
    }
  | { ok: false; error: string };

const CLAWBACK_LEDGER_TYPES: LedgerType[] = [
  LedgerType.clawback_crm,
  LedgerType.clawback_cordoba,
  LedgerType.clawback_history,
];

/**
 * Super-admin: set historical paidRate on the cleared file + clawback row,
 * recalculate clawback $ = debt × rate, reverse/replace ledger, recompute rollup.
 */
export async function setClawbackPaidRate(opts: {
  clientEventId: string;
  ratePercentInput: string;
  actorLabel?: string;
}): Promise<SetClawbackPaidRateResult> {
  const paidRate = parsePaidRatePercentInput(opts.ratePercentInput);
  if (paidRate == null) {
    return {
      ok: false,
      error: "Enter a rate like 1.75 (percent). Must be greater than 0 and at most 10%.",
    };
  }

  const claw = await prisma.clientEvent.findUnique({
    where: { id: opts.clientEventId },
  });
  if (!claw) return { ok: false, error: "Clawback row not found." };
  if (!claw.clawbackApplied && claw.kind !== "clawback" && claw.kind !== "cordoba_clawback") {
    return { ok: false, error: "That row is not a clawback." };
  }
  if (!claw.crmId) return { ok: false, error: "Clawback has no CRM id." };
  if (!claw.agentPeriodId) {
    return { ok: false, error: "Clawback is not attached to an agent period." };
  }

  const debt = Number(claw.enrolledDebt) || 0;
  if (!(debt > 0)) {
    return { ok: false, error: "Clawback has no enrolled debt to apply a rate against." };
  }

  const newAmount = clawbackAmountFromPaidRate(debt, paidRate);
  if (!(newAmount > 0)) {
    return { ok: false, error: "Calculated clawback is $0 — check debt and rate." };
  }

  const oldAmount = Number(claw.clawbackAmount) || 0;
  const pctLabel = `${(paidRate * 100).toFixed(2)}%`;
  const who = opts.actorLabel?.trim() || "super admin";
  const note = `Paid rate set to ${pctLabel} by ${who} (debt × rate)`;

  // Persist rate on cleared evidence so CRM / Cordoba re-ingest prefers it.
  await prisma.clientEvent.updateMany({
    where: { crmId: claw.crmId, isCleared: true },
    data: { paidRate: dec(paidRate) },
  });

  await prisma.clientEvent.update({
    where: { id: claw.id },
    data: {
      paidRate: dec(paidRate),
      clawbackAmount: dec(newAmount),
    },
  });

  const ledgers = await prisma.ledgerEntry.findMany({
    where: {
      crmId: claw.crmId,
      agentPeriodId: claw.agentPeriodId,
      type: { in: CLAWBACK_LEDGER_TYPES },
      reversesEntryId: null,
    },
    include: { reversedBy: true },
    orderBy: { createdAt: "desc" },
  });
  const active = ledgers.find((e) => !e.reversedBy);

  if (active) {
    if (Math.abs(Number(active.amount) - newAmount) > 0.001) {
      await prisma.ledgerEntry.create({
        data: {
          type: LedgerType.reversal,
          amount: active.amount,
          crmId: active.crmId,
          agentName: active.agentName,
          periodId: active.periodId,
          agentPeriodId: active.agentPeriodId,
          reasonCode: "paid_rate_override",
          note: `Reverse $${Number(active.amount).toFixed(2)} before ${note}`,
          reversesEntryId: active.id,
        },
      });
      await prisma.ledgerEntry.create({
        data: {
          type: active.type,
          amount: dec(newAmount),
          crmId: claw.crmId,
          agentName: claw.agentName,
          periodId: claw.periodId,
          agentPeriodId: claw.agentPeriodId,
          reasonCode: "paid_rate_override",
          note: `${note}; was $${oldAmount.toFixed(2)}`,
        },
      });
    }
  } else {
    // Cordoba/CRM row without a live ledger — write one so rollup matches.
    const type =
      claw.kind === "cordoba_clawback"
        ? LedgerType.clawback_cordoba
        : claw.kind === "history_subtract"
          ? LedgerType.clawback_history
          : LedgerType.clawback_crm;
    await prisma.ledgerEntry.create({
      data: {
        type,
        amount: dec(newAmount),
        crmId: claw.crmId,
        agentName: claw.agentName,
        periodId: claw.periodId,
        agentPeriodId: claw.agentPeriodId,
        reasonCode: "paid_rate_override",
        note,
      },
    });
  }

  await recomputeAgentPeriodClawbacks(claw.agentPeriodId, note);

  return {
    ok: true,
    paidRate,
    clawbackAmount: newAmount,
    message: `Clawback set to −$${newAmount.toFixed(2)} at ${pctLabel}.`,
  };
}

/**
 * Super-admin: set paidRate on cleared file only (Cordoba-flagged $0 row).
 * Next Cordoba money apply will use debt × rate.
 */
export async function setClearedPaidRateForCrmId(opts: {
  crmId: string;
  ratePercentInput: string;
  actorLabel?: string;
}): Promise<SetClawbackPaidRateResult> {
  const paidRate = parsePaidRatePercentInput(opts.ratePercentInput);
  if (paidRate == null) {
    return {
      ok: false,
      error: "Enter a rate like 1.75 (percent). Must be greater than 0 and at most 10%.",
    };
  }

  const cleared = await prisma.clientEvent.findFirst({
    where: { crmId: opts.crmId, isCleared: true },
    orderBy: { id: "desc" },
  });
  if (!cleared) {
    return { ok: false, error: "No cleared commission row found for that client." };
  }

  const debt = Number(cleared.enrolledDebt) || 0;
  const preview = clawbackAmountFromPaidRate(debt, paidRate);
  const pctLabel = `${(paidRate * 100).toFixed(2)}%`;

  await prisma.clientEvent.updateMany({
    where: { crmId: opts.crmId, isCleared: true },
    data: { paidRate: dec(paidRate) },
  });

  return {
    ok: true,
    paidRate,
    clawbackAmount: preview,
    message: `Paid rate ${pctLabel} saved on cleared file${
      preview > 0 ? ` (preview clawback −$${preview.toFixed(2)} when Cordoba deducts)` : ""
    }.`,
  };
}
