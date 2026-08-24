import { prisma } from "@/lib/db";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";
import {
  LedgerType,
  ManualBonusStatus,
  PeriodSource,
  Prisma,
} from "@/generated/prisma/client";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export type ManualBonusActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type ManualBonusView = {
  id: string;
  amount: number;
  note: string;
  status: "pending" | "approved";
  periodLabel: string;
  agentName: string;
  createdByName: string;
  createdById: string;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  agentPeriodId: string | null;
  periodId: string | null;
};

function mapBonus(row: {
  id: string;
  amount: Prisma.Decimal;
  note: string;
  status: ManualBonusStatus;
  periodLabel: string;
  agentName: string;
  createdById: string;
  approvedAt: Date | null;
  createdAt: Date;
  agentPeriodId: string | null;
  createdBy: { id: string; displayName: string };
  approvedBy: { displayName: string } | null;
  agentPeriod?: { id: string; periodId: string } | null;
}): ManualBonusView {
  return {
    id: row.id,
    amount: Number(row.amount),
    note: row.note,
    status: row.status,
    periodLabel: row.periodLabel,
    agentName: row.agentName,
    createdByName: row.createdBy.displayName,
    createdById: row.createdById,
    approvedByName: row.approvedBy?.displayName ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    agentPeriodId: row.agentPeriod?.id ?? row.agentPeriodId,
    periodId: row.agentPeriod?.periodId ?? null,
  };
}

const include = {
  createdBy: { select: { id: true, displayName: true } },
  approvedBy: { select: { displayName: true } },
  agentPeriod: { select: { id: true, periodId: true } },
} as const;

export async function listManualBonusesForAgentPeriod(opts: {
  agentPeriodId: string;
  periodLabel: string;
  agentName: string;
}): Promise<ManualBonusView[]> {
  const rows = await prisma.manualBonus.findMany({
    where: {
      OR: [
        { agentPeriodId: opts.agentPeriodId },
        { periodLabel: opts.periodLabel, agentName: opts.agentName },
      ],
    },
    include,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  // Dedupe if both OR arms match the same row
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return unique.map(mapBonus);
}

export async function listPendingManualBonuses(): Promise<ManualBonusView[]> {
  const rows = await prisma.manualBonus.findMany({
    where: { status: ManualBonusStatus.pending },
    include,
    orderBy: { createdAt: "asc" },
  });
  return attachMissingPeriodLinks(rows.map(mapBonus));
}

/** Pending + approved for the super-admin “View all” history page. */
export async function listManualBonusesForAdmin(opts?: {
  /** Cap approved history rows (pending always included). Default 200. */
  historyLimit?: number;
}): Promise<{ pending: ManualBonusView[]; approved: ManualBonusView[] }> {
  const historyLimit = opts?.historyLimit ?? 200;
  const [pendingRows, approvedRows] = await Promise.all([
    prisma.manualBonus.findMany({
      where: { status: ManualBonusStatus.pending },
      include,
      orderBy: { createdAt: "asc" },
    }),
    prisma.manualBonus.findMany({
      where: { status: ManualBonusStatus.approved },
      include,
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      take: historyLimit,
    }),
  ]);

  const [pending, approved] = await Promise.all([
    attachMissingPeriodLinks(pendingRows.map(mapBonus)),
    attachMissingPeriodLinks(approvedRows.map(mapBonus)),
  ]);
  return { pending, approved };
}

async function attachMissingPeriodLinks(
  mapped: ManualBonusView[],
): Promise<ManualBonusView[]> {
  const missingPeriod = mapped.filter((b) => !b.periodId);
  if (!missingPeriod.length) return mapped;

  const periods = await prisma.agentPeriod.findMany({
    where: {
      OR: missingPeriod.map((b) => ({
        agentName: b.agentName,
        period: { periodLabel: b.periodLabel, source: PeriodSource.calculated },
      })),
    },
    select: {
      id: true,
      periodId: true,
      agentName: true,
      period: { select: { periodLabel: true } },
    },
  });
  const byKey = new Map(
    periods.map((p) => [`${p.period.periodLabel}\0${p.agentName}`, p] as const),
  );

  return mapped.map((b) => {
    if (b.periodId) return b;
    const hit = byKey.get(`${b.periodLabel}\0${b.agentName}`);
    if (!hit) return b;
    return { ...b, agentPeriodId: hit.id, periodId: hit.periodId };
  });
}

export async function countPendingManualBonuses(): Promise<number> {
  return prisma.manualBonus.count({
    where: { status: ManualBonusStatus.pending },
  });
}

export async function createManualBonus(opts: {
  agentPeriodId: string;
  createdById: string;
  amount: number;
  note: string;
}): Promise<ManualBonusActionResult> {
  const note = opts.note.trim();
  if (!note) return { ok: false, error: "Note is required." };
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  const amount = Math.round(opts.amount * 100) / 100;

  const ap = await prisma.agentPeriod.findUnique({
    where: { id: opts.agentPeriodId },
    include: { period: { select: { periodLabel: true, source: true } } },
  });
  if (!ap || ap.period.source !== PeriodSource.calculated) {
    return { ok: false, error: "Agent period not found." };
  }

  await prisma.manualBonus.create({
    data: {
      periodLabel: ap.period.periodLabel,
      agentName: ap.agentName,
      agentPeriodId: ap.id,
      amount: dec(amount),
      note,
      status: ManualBonusStatus.pending,
      createdById: opts.createdById,
    },
  });

  return { ok: true, message: "Manual bonus submitted for super-admin approval." };
}

export async function updatePendingManualBonus(opts: {
  bonusId: string;
  actorId: string;
  amount: number;
  note: string;
}): Promise<ManualBonusActionResult> {
  const note = opts.note.trim();
  if (!note) return { ok: false, error: "Note is required." };
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  const amount = Math.round(opts.amount * 100) / 100;

  const row = await prisma.manualBonus.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Bonus not found." };
  if (row.status !== ManualBonusStatus.pending) {
    return { ok: false, error: "Only pending bonuses can be edited." };
  }

  await prisma.manualBonus.update({
    where: { id: opts.bonusId },
    data: { amount: dec(amount), note },
  });
  return { ok: true, message: "Manual bonus updated." };
}

export async function deletePendingManualBonus(opts: {
  bonusId: string;
}): Promise<ManualBonusActionResult> {
  const row = await prisma.manualBonus.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Bonus not found." };
  if (row.status !== ManualBonusStatus.pending) {
    return { ok: false, error: "Only pending bonuses can be deleted by managers." };
  }
  await prisma.manualBonus.delete({ where: { id: opts.bonusId } });
  return { ok: true, message: "Manual bonus deleted." };
}

export async function approveManualBonus(opts: {
  bonusId: string;
  approvedById: string;
}): Promise<
  ManualBonusActionResult & { agentPeriodId?: string; periodId?: string }
> {
  const row = await prisma.manualBonus.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Bonus not found." };
  if (row.status !== ManualBonusStatus.pending) {
    return { ok: false, error: "Bonus is already approved." };
  }

  let agentPeriodId = row.agentPeriodId;
  let periodId: string | null = null;
  if (agentPeriodId) {
    const ap = await prisma.agentPeriod.findUnique({
      where: { id: agentPeriodId },
      select: { id: true, periodId: true },
    });
    if (ap) periodId = ap.periodId;
    else agentPeriodId = null;
  }
  if (!agentPeriodId || !periodId) {
    const ap = await prisma.agentPeriod.findFirst({
      where: {
        agentName: row.agentName,
        period: {
          periodLabel: row.periodLabel,
          source: PeriodSource.calculated,
        },
      },
      select: { id: true, periodId: true },
    });
    if (!ap) {
      return {
        ok: false,
        error: "No calculated agent period found for this bonus — re-upload CRM first.",
      };
    }
    agentPeriodId = ap.id;
    periodId = ap.periodId;
  }

  const amount = Number(row.amount);
  const ledger = await prisma.ledgerEntry.create({
    data: {
      type: LedgerType.manual_bonus,
      amount: dec(amount),
      agentName: row.agentName,
      periodId,
      agentPeriodId,
      reasonCode: "manual_bonus",
      note: row.note,
    },
  });

  await prisma.manualBonus.update({
    where: { id: row.id },
    data: {
      status: ManualBonusStatus.approved,
      approvedById: opts.approvedById,
      approvedAt: new Date(),
      agentPeriodId,
      ledgerEntryId: ledger.id,
    },
  });

  await recomputeAgentPeriodClawbacks(agentPeriodId);
  return {
    ok: true,
    message: "Manual bonus approved and added to net commission.",
    agentPeriodId,
    periodId,
  };
}

/**
 * After CRM recreates AgentPeriod rows: re-attach bonuses and re-write approved ledger credits.
 */
export async function relinkManualBonuses(opts: {
  periodLabel: string;
  agentPeriods: Array<{ id: string; agentName: string }>;
}) {
  for (const ap of opts.agentPeriods) {
    const bonuses = await prisma.manualBonus.findMany({
      where: {
        periodLabel: opts.periodLabel,
        agentName: ap.agentName,
      },
    });
    if (!bonuses.length) continue;

    const agentPeriod = await prisma.agentPeriod.findUnique({
      where: { id: ap.id },
      select: { id: true, periodId: true },
    });
    if (!agentPeriod) continue;

    for (const b of bonuses) {
      await prisma.manualBonus.update({
        where: { id: b.id },
        data: { agentPeriodId: ap.id, ledgerEntryId: null },
      });

      if (b.status !== ManualBonusStatus.approved) continue;

      const ledger = await prisma.ledgerEntry.create({
        data: {
          type: LedgerType.manual_bonus,
          amount: b.amount,
          agentName: b.agentName,
          periodId: agentPeriod.periodId,
          agentPeriodId: ap.id,
          reasonCode: "manual_bonus",
          note: b.note,
        },
      });
      await prisma.manualBonus.update({
        where: { id: b.id },
        data: { ledgerEntryId: ledger.id },
      });
    }

    await recomputeAgentPeriodClawbacks(ap.id);
  }
}
