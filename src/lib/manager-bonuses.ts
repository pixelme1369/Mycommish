import { prisma } from "@/lib/db";
import {
  AgentRole,
  ManagerBonusStatus,
  PeriodSource,
  PeriodStatus,
  Prisma,
} from "@/generated/prisma/client";
import { paymentDateForPeriod } from "@/lib/commission/calculator";

export {
  parsePaidOnDate,
  periodLabelForNextPayDate,
  periodLabelFromDate,
} from "@/lib/manager-bonus-dates";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export async function listBonusRecipientAgents() {
  return prisma.agent.findMany({
    where: {
      role: AgentRole.agent,
      suspendedAt: null,
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
}

export async function listOpenPeriodLabels(): Promise<string[]> {
  const rows = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated, status: PeriodStatus.open },
    select: { periodLabel: true },
    orderBy: { periodLabel: "desc" },
  });
  return [...new Set(rows.map((r) => r.periodLabel))];
}

export type ManagerBonusRow = {
  id: string;
  amount: number;
  reason: string;
  paidOn: Date;
  periodLabel: string;
  status: ManagerBonusStatus;
  reimbursedAt: Date | null;
  paidBy: { id: string; displayName: string };
  recipientAgent: { id: string; displayName: string };
};

const bonusInclude = {
  paidBy: { select: { id: true, displayName: true } },
  recipientAgent: { select: { id: true, displayName: true } },
} as const;

function mapBonus(row: {
  id: string;
  amount: Prisma.Decimal;
  reason: string;
  paidOn: Date;
  periodLabel: string;
  status: ManagerBonusStatus;
  reimbursedAt: Date | null;
  paidBy: { id: string; displayName: string };
  recipientAgent: { id: string; displayName: string };
}): ManagerBonusRow {
  return {
    id: row.id,
    amount: Number(row.amount),
    reason: row.reason,
    paidOn: row.paidOn,
    periodLabel: row.periodLabel,
    status: row.status,
    reimbursedAt: row.reimbursedAt,
    paidBy: row.paidBy,
    recipientAgent: row.recipientAgent,
  };
}

export async function listMyBonuses(paidById: string): Promise<ManagerBonusRow[]> {
  const rows = await prisma.managerBonusPayout.findMany({
    where: { paidById },
    include: bonusInclude,
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapBonus);
}

export async function sumMyOwedBonuses(paidById: string): Promise<number> {
  const agg = await prisma.managerBonusPayout.aggregate({
    where: { paidById, status: ManagerBonusStatus.owed },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

export async function listBonusesForPeriod(
  periodLabel: string,
  opts?: { paidById?: string },
): Promise<ManagerBonusRow[]> {
  const rows = await prisma.managerBonusPayout.findMany({
    where: {
      periodLabel,
      ...(opts?.paidById ? { paidById: opts.paidById } : {}),
    },
    include: bonusInclude,
    orderBy: [{ paidById: "asc" }, { paidOn: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapBonus);
}

export type ManagerBonusGroup = {
  paidById: string;
  paidByName: string;
  owed: ManagerBonusRow[];
  reimbursed: ManagerBonusRow[];
  owedTotal: number;
  reimbursedTotal: number;
};

export function groupBonusesByManager(rows: ManagerBonusRow[]): ManagerBonusGroup[] {
  const by = new Map<string, ManagerBonusGroup>();
  for (const r of rows) {
    let g = by.get(r.paidBy.id);
    if (!g) {
      g = {
        paidById: r.paidBy.id,
        paidByName: r.paidBy.displayName,
        owed: [],
        reimbursed: [],
        owedTotal: 0,
        reimbursedTotal: 0,
      };
      by.set(r.paidBy.id, g);
    }
    if (r.status === ManagerBonusStatus.owed) {
      g.owed.push(r);
      g.owedTotal += r.amount;
    } else {
      g.reimbursed.push(r);
      g.reimbursedTotal += r.amount;
    }
  }
  return [...by.values()].sort((a, b) => a.paidByName.localeCompare(b.paidByName));
}

export function payDateLabel(periodLabel: string): string {
  const d = paymentDateForPeriod(periodLabel);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type BonusActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function createManagerBonus(opts: {
  paidById: string;
  recipientAgentId: string;
  amount: number;
  reason: string;
  paidOn: Date;
  periodLabel: string;
}): Promise<BonusActionResult> {
  const reason = opts.reason.trim();
  if (!reason) return { ok: false, error: "Reason is required." };
  if (!(opts.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
  if (!/^\d{4}-\d{2}$/.test(opts.periodLabel)) {
    return { ok: false, error: "Invalid commission period." };
  }

  const recipient = await prisma.agent.findFirst({
    where: {
      id: opts.recipientAgentId,
      role: AgentRole.agent,
      suspendedAt: null,
    },
    select: { id: true },
  });
  if (!recipient) return { ok: false, error: "Choose a valid agent." };

  await prisma.managerBonusPayout.create({
    data: {
      paidById: opts.paidById,
      recipientAgentId: opts.recipientAgentId,
      amount: dec(Math.round(opts.amount * 100) / 100),
      reason,
      paidOn: opts.paidOn,
      periodLabel: opts.periodLabel,
      status: ManagerBonusStatus.owed,
    },
  });

  return { ok: true, message: "Bonus logged." };
}

export async function deleteOwedBonus(opts: {
  bonusId: string;
  paidById: string;
  /** Admins can delete any owed row. */
  asAdmin?: boolean;
}): Promise<BonusActionResult> {
  const row = await prisma.managerBonusPayout.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== ManagerBonusStatus.owed) {
    return { ok: false, error: "Only unpaid (owed) rows can be deleted." };
  }
  if (!opts.asAdmin && row.paidById !== opts.paidById) {
    return { ok: false, error: "Not your bonus row." };
  }
  await prisma.managerBonusPayout.delete({ where: { id: opts.bonusId } });
  return { ok: true, message: "Deleted." };
}

export async function markBonusReimbursed(opts: {
  bonusId: string;
  reimbursedById: string;
}): Promise<BonusActionResult> {
  const row = await prisma.managerBonusPayout.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Not found." };
  if (row.status === ManagerBonusStatus.reimbursed) {
    return { ok: true, message: "Already reimbursed." };
  }
  await prisma.managerBonusPayout.update({
    where: { id: opts.bonusId },
    data: {
      status: ManagerBonusStatus.reimbursed,
      reimbursedAt: new Date(),
      reimbursedById: opts.reimbursedById,
    },
  });
  return { ok: true, message: "Marked reimbursed." };
}

export async function markManagerBonusesReimbursed(opts: {
  periodLabel: string;
  paidById: string;
  reimbursedById: string;
}): Promise<BonusActionResult> {
  const result = await prisma.managerBonusPayout.updateMany({
    where: {
      periodLabel: opts.periodLabel,
      paidById: opts.paidById,
      status: ManagerBonusStatus.owed,
    },
    data: {
      status: ManagerBonusStatus.reimbursed,
      reimbursedAt: new Date(),
      reimbursedById: opts.reimbursedById,
    },
  });
  return {
    ok: true,
    message: `Marked ${result.count} payout${result.count === 1 ? "" : "s"} reimbursed.`,
  };
}

export async function undoBonusReimbursed(opts: {
  bonusId: string;
}): Promise<BonusActionResult> {
  const row = await prisma.managerBonusPayout.findUnique({ where: { id: opts.bonusId } });
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== ManagerBonusStatus.reimbursed) {
    return { ok: false, error: "Row is not reimbursed." };
  }
  await prisma.managerBonusPayout.update({
    where: { id: opts.bonusId },
    data: {
      status: ManagerBonusStatus.owed,
      reimbursedAt: null,
      reimbursedById: null,
    },
  });
  return { ok: true, message: "Reopened as owed." };
}
