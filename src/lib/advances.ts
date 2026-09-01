import { prisma } from "@/lib/db";
import {
  LedgerType,
  PeriodSource,
  Prisma,
} from "@/generated/prisma/client";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";
import { paymentDateForPeriod } from "@/lib/commission/calculator";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export type AdvanceActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

export type AdvanceView = {
  id: string;
  agentName: string;
  agentId: string | null;
  amount: number;
  note: string | null;
  payWithPeriodLabel: string;
  deductFromPeriodLabel: string;
  createdByName: string;
  createdAt: string;
  cancelledAt: string | null;
  payApplied: boolean;
  repayApplied: boolean;
};

function mapAdvance(row: {
  id: string;
  agentName: string;
  agentId: string | null;
  amount: Prisma.Decimal;
  note: string | null;
  payWithPeriodLabel: string;
  deductFromPeriodLabel: string;
  createdAt: Date;
  cancelledAt: Date | null;
  payLedgerEntryId: string | null;
  repayLedgerEntryId: string | null;
  createdBy: { displayName: string };
}): AdvanceView {
  return {
    id: row.id,
    agentName: row.agentName,
    agentId: row.agentId,
    amount: Number(row.amount),
    note: row.note,
    payWithPeriodLabel: row.payWithPeriodLabel,
    deductFromPeriodLabel: row.deductFromPeriodLabel,
    createdByName: row.createdBy.displayName,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    payApplied: Boolean(row.payLedgerEntryId),
    repayApplied: Boolean(row.repayLedgerEntryId),
  };
}

const include = {
  createdBy: { select: { displayName: true } },
} as const;

export function payDateLabel(periodLabel: string): string {
  const d = paymentDateForPeriod(periodLabel);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function findCalculatedAgentPeriod(agentName: string, periodLabel: string) {
  return prisma.agentPeriod.findFirst({
    where: {
      agentName,
      period: { periodLabel, source: PeriodSource.calculated },
    },
    select: { id: true, periodId: true },
  });
}

async function ensurePayLedger(opts: {
  advanceId: string;
  agentName: string;
  amount: number;
  note: string | null;
  periodLabel: string;
}) {
  const ap = await findCalculatedAgentPeriod(opts.agentName, opts.periodLabel);
  if (!ap) return { applied: false as const };

  const existing = await prisma.commissionAdvance.findUnique({
    where: { id: opts.advanceId },
    select: { payLedgerEntryId: true },
  });
  if (existing?.payLedgerEntryId) {
    const still = await prisma.ledgerEntry.findUnique({
      where: { id: existing.payLedgerEntryId },
    });
    if (still) {
      await prisma.commissionAdvance.update({
        where: { id: opts.advanceId },
        data: { payAgentPeriodId: ap.id },
      });
      return { applied: true as const, agentPeriodId: ap.id };
    }
  }

  const ledger = await prisma.ledgerEntry.create({
    data: {
      type: LedgerType.advance_paid,
      amount: dec(opts.amount),
      agentName: opts.agentName,
      periodId: ap.periodId,
      agentPeriodId: ap.id,
      reasonCode: "advance_paid",
      note: opts.note || `Advance vs later period`,
    },
  });

  await prisma.commissionAdvance.update({
    where: { id: opts.advanceId },
    data: {
      payAgentPeriodId: ap.id,
      payLedgerEntryId: ledger.id,
    },
  });

  await recomputeAgentPeriodClawbacks(ap.id);
  return { applied: true as const, agentPeriodId: ap.id };
}

async function ensureRepayLedger(opts: {
  advanceId: string;
  agentName: string;
  amount: number;
  note: string | null;
  periodLabel: string;
  payWithPeriodLabel: string;
}) {
  const ap = await findCalculatedAgentPeriod(opts.agentName, opts.periodLabel);
  if (!ap) return { applied: false as const };

  const existing = await prisma.commissionAdvance.findUnique({
    where: { id: opts.advanceId },
    select: { repayLedgerEntryId: true },
  });
  if (existing?.repayLedgerEntryId) {
    const still = await prisma.ledgerEntry.findUnique({
      where: { id: existing.repayLedgerEntryId },
    });
    if (still) {
      await prisma.commissionAdvance.update({
        where: { id: opts.advanceId },
        data: { repayAgentPeriodId: ap.id },
      });
      return { applied: true as const, agentPeriodId: ap.id };
    }
  }

  const ledger = await prisma.ledgerEntry.create({
    data: {
      type: LedgerType.advance_repay,
      amount: dec(opts.amount),
      agentName: opts.agentName,
      periodId: ap.periodId,
      agentPeriodId: ap.id,
      reasonCode: "advance_repay",
      note:
        opts.note ||
        `Repay advance paid with ${opts.payWithPeriodLabel}`,
    },
  });

  await prisma.commissionAdvance.update({
    where: { id: opts.advanceId },
    data: {
      repayAgentPeriodId: ap.id,
      repayLedgerEntryId: ledger.id,
    },
  });

  await recomputeAgentPeriodClawbacks(ap.id);
  return { applied: true as const, agentPeriodId: ap.id };
}

export async function createAdvance(opts: {
  createdById: string;
  agentName: string;
  agentId?: string | null;
  amount: number;
  note?: string | null;
  payWithPeriodLabel: string;
  deductFromPeriodLabel: string;
}): Promise<AdvanceActionResult> {
  const agentName = opts.agentName.trim();
  const payWith = opts.payWithPeriodLabel.trim();
  const deductFrom = opts.deductFromPeriodLabel.trim();
  const amount = Math.round(opts.amount * 100) / 100;

  if (!agentName) return { ok: false, error: "Agent name is required." };
  if (!payWith || !deductFrom) {
    return { ok: false, error: "Pay-with and deduct-from periods are required." };
  }
  if (!/^\d{4}-\d{2}$/.test(payWith) || !/^\d{4}-\d{2}$/.test(deductFrom)) {
    return { ok: false, error: "Periods must be YYYY-MM." };
  }
  if (deductFrom <= payWith) {
    return {
      ok: false,
      error: "Deduct-from period must be after the pay-with period.",
    };
  }
  if (!(amount > 0)) return { ok: false, error: "Amount must be greater than zero." };

  const row = await prisma.commissionAdvance.create({
    data: {
      agentName,
      agentId: opts.agentId || null,
      amount: dec(amount),
      note: opts.note?.trim() || null,
      payWithPeriodLabel: payWith,
      deductFromPeriodLabel: deductFrom,
      createdById: opts.createdById,
    },
  });

  const pay = await ensurePayLedger({
    advanceId: row.id,
    agentName,
    amount,
    note: row.note,
    periodLabel: payWith,
  });
  const repay = await ensureRepayLedger({
    advanceId: row.id,
    agentName,
    amount,
    note: row.note,
    periodLabel: deductFrom,
    payWithPeriodLabel: payWith,
  });

  const bits = [
    pay.applied
      ? `+$${amount.toFixed(2)} on ${payWith}`
      : `queued +$${amount.toFixed(2)} for ${payWith} (upload CRM when ready)`,
    repay.applied
      ? `−$${amount.toFixed(2)} on ${deductFrom}`
      : `queued −$${amount.toFixed(2)} for ${deductFrom} (applies when that period exists)`,
  ];

  return {
    ok: true,
    id: row.id,
    message: `Advance saved · ${bits.join(" · ")}`,
  };
}

export async function cancelAdvance(opts: {
  advanceId: string;
}): Promise<AdvanceActionResult> {
  const row = await prisma.commissionAdvance.findUnique({
    where: { id: opts.advanceId },
  });
  if (!row) return { ok: false, error: "Advance not found." };
  if (row.cancelledAt) return { ok: false, error: "Advance is already cancelled." };

  const touchPeriods = new Set<string>();

  async function reverseLedger(ledgerId: string | null) {
    if (!ledgerId) return;
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id: ledgerId },
      include: { reversedBy: true },
    });
    if (!entry || entry.reversedBy) return;
    await prisma.ledgerEntry.create({
      data: {
        type: LedgerType.reversal,
        amount: entry.amount,
        agentName: entry.agentName,
        periodId: entry.periodId,
        agentPeriodId: entry.agentPeriodId,
        reasonCode: "advance_cancel",
        note: `Cancel advance ${opts.advanceId}`,
        reversesEntryId: entry.id,
      },
    });
    if (entry.agentPeriodId) touchPeriods.add(entry.agentPeriodId);
  }

  await reverseLedger(row.payLedgerEntryId);
  await reverseLedger(row.repayLedgerEntryId);

  await prisma.commissionAdvance.update({
    where: { id: row.id },
    data: {
      cancelledAt: new Date(),
      payLedgerEntryId: null,
      repayLedgerEntryId: null,
    },
  });

  for (const apId of touchPeriods) {
    await recomputeAgentPeriodClawbacks(apId);
  }

  return { ok: true, message: "Advance cancelled and removed from net." };
}

export async function listAdvances(opts?: { includeCancelled?: boolean }) {
  const rows = await prisma.commissionAdvance.findMany({
    where: opts?.includeCancelled ? undefined : { cancelledAt: null },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(mapAdvance);
}

export async function listAdvancesForAgentPeriod(opts: {
  agentName: string;
  periodLabel: string;
}): Promise<AdvanceView[]> {
  const rows = await prisma.commissionAdvance.findMany({
    where: {
      cancelledAt: null,
      agentName: opts.agentName,
      OR: [
        { payWithPeriodLabel: opts.periodLabel },
        { deductFromPeriodLabel: opts.periodLabel },
      ],
    },
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapAdvance);
}

/**
 * After CRM recreates AgentPeriod rows: re-attach advance ledgers for this period.
 * Advances themselves live in CommissionAdvance and survive period delete.
 */
export async function relinkAdvances(opts: {
  periodLabel: string;
  agentPeriods: Array<{ id: string; agentName: string }>;
}) {
  const byName = new Map(
    opts.agentPeriods.map((a) => [a.agentName.trim().toLowerCase(), a]),
  );
  const advances = await prisma.commissionAdvance.findMany({
    where: {
      cancelledAt: null,
      OR: [
        { payWithPeriodLabel: opts.periodLabel },
        { deductFromPeriodLabel: opts.periodLabel },
      ],
    },
  });

  for (const a of advances) {
    const ap = byName.get(a.agentName.trim().toLowerCase());
    if (!ap) continue;
    const amount = Number(a.amount);

    if (a.payWithPeriodLabel === opts.periodLabel) {
      await prisma.commissionAdvance.update({
        where: { id: a.id },
        data: {
          agentName: ap.agentName,
          payLedgerEntryId: null,
          payAgentPeriodId: null,
        },
      });
      await ensurePayLedger({
        advanceId: a.id,
        agentName: ap.agentName,
        amount,
        note: a.note,
        periodLabel: a.payWithPeriodLabel,
      });
    }
    if (a.deductFromPeriodLabel === opts.periodLabel) {
      await prisma.commissionAdvance.update({
        where: { id: a.id },
        data: {
          agentName: ap.agentName,
          repayLedgerEntryId: null,
          repayAgentPeriodId: null,
        },
      });
      await ensureRepayLedger({
        advanceId: a.id,
        agentName: ap.agentName,
        amount,
        note: a.note,
        periodLabel: a.deductFromPeriodLabel,
        payWithPeriodLabel: a.payWithPeriodLabel,
      });
    }
  }
}

export async function listAdvanceAgentChoices() {
  const [aliases, periodNames] = await Promise.all([
    prisma.agentAlias.findMany({
      include: {
        agent: {
          select: { id: true, displayName: true, role: true, suspendedAt: true },
        },
      },
      orderBy: { agentName: "asc" },
    }),
    prisma.agentPeriod.findMany({
      where: { period: { source: PeriodSource.calculated } },
      select: { agentName: true },
      distinct: ["agentName"],
      orderBy: { agentName: "asc" },
    }),
  ]);

  const byName = new Map<
    string,
    { agentName: string; agentId: string; displayName: string; role: string }
  >();

  for (const a of aliases) {
    if (a.agent.suspendedAt) continue;
    if (a.agent.role === "opener") continue;
    byName.set(a.agentName, {
      agentName: a.agentName,
      agentId: a.agentId,
      displayName: a.agent.displayName,
      role: a.agent.role,
    });
  }

  // CRM Sales Rep spellings that appear on calculated periods (even without a login alias).
  for (const p of periodNames) {
    if (byName.has(p.agentName)) continue;
    byName.set(p.agentName, {
      agentName: p.agentName,
      agentId: "",
      displayName: p.agentName,
      role: "agent",
    });
  }

  return [...byName.values()].sort((a, b) =>
    a.agentName.localeCompare(b.agentName),
  );
}

export async function listCalculatedPeriodLabels(): Promise<string[]> {
  const rows = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    select: { periodLabel: true },
    orderBy: { periodLabel: "desc" },
    take: 24,
  });
  return [...new Set(rows.map((r) => r.periodLabel))];
}
