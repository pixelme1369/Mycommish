import { prisma } from "@/lib/db";
import {
  AgentRole,
  ManagerBonusStatus,
  PeriodSource,
  PeriodStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { ManagerBonusRow } from "@/lib/manager-bonus-view";

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
      // Agents and managers (e.g. Kiwi) — not admins.
      role: { in: [AgentRole.agent, AgentRole.manager] },
      suspendedAt: null,
    },
    select: { id: true, displayName: true, role: true },
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

const bonusInclude = {
  paidBy: { select: { id: true, displayName: true, role: true } },
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
  recipientName: string;
  recipientAgentId: string | null;
  paidBy: { id: string; displayName: string; role: AgentRole };
  recipientAgent: { id: string; displayName: string } | null;
}): ManagerBonusRow {
  return {
    id: row.id,
    amount: Number(row.amount),
    reason: row.reason,
    paidOn: row.paidOn,
    periodLabel: row.periodLabel,
    status: row.status,
    reimbursedAt: row.reimbursedAt,
    paidBy: {
      id: row.paidBy.id,
      displayName: row.paidBy.displayName,
      role: row.paidBy.role,
    },
    recipientName: row.recipientName || row.recipientAgent?.displayName || "—",
    recipientAgentId: row.recipientAgentId,
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

export type BonusActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function createManagerBonus(opts: {
  paidById: string;
  recipientAgentId?: string | null;
  recipientName: string;
  amount: number;
  reason: string;
  paidOn: Date;
  periodLabel: string;
}): Promise<BonusActionResult> {
  const reason = opts.reason.trim();
  const recipientName = opts.recipientName.trim();
  if (!reason) return { ok: false, error: "Reason is required." };
  if (!recipientName) return { ok: false, error: "Agent name is required." };
  if (!(opts.amount > 0)) return { ok: false, error: "Amount must be greater than zero." };
  if (!/^\d{4}-\d{2}$/.test(opts.periodLabel)) {
    return { ok: false, error: "Invalid commission period." };
  }

  let recipientAgentId: string | null = opts.recipientAgentId?.trim() || null;
  if (recipientAgentId) {
    const recipient = await prisma.agent.findFirst({
      where: {
        id: recipientAgentId,
        role: { in: [AgentRole.agent, AgentRole.manager] },
        suspendedAt: null,
      },
      select: { id: true, displayName: true },
    });
    if (!recipient) {
      // Typed name that no longer matches — keep freehand name only.
      recipientAgentId = null;
    }
  }

  await prisma.managerBonusPayout.create({
    data: {
      paidBy: { connect: { id: opts.paidById } },
      ...(recipientAgentId
        ? { recipientAgent: { connect: { id: recipientAgentId } } }
        : {}),
      recipientName,
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
