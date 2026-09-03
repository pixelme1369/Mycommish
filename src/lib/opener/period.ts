import { prisma } from "@/lib/db";
import { PeriodStatus } from "@/generated/prisma/client";
import { listOpenerPlanAgents } from "@/lib/agents/opener";
import {
  openerCommissionForPayStatus,
  openerPeriodFromYmd,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";

export const OPENER_PERIOD_LOCKED = "This pay period is closed.";

export type OpenerPeriodView = {
  monthLabel: string;
  status: "open" | "closed";
  closedAt: string | null;
  paidAt: string | null;
  locked: boolean;
  paid: boolean;
};

export function openerPeriodViewFromRow(row: {
  monthLabel: string;
  status: PeriodStatus;
  closedAt: Date | null;
  paidAt: Date | null;
} | null, monthLabel: string): OpenerPeriodView {
  const status = row?.status === PeriodStatus.closed ? "closed" : "open";
  const paid = Boolean(row?.paidAt);
  const locked = status === "closed" || paid;
  return {
    monthLabel,
    status,
    closedAt: row?.closedAt?.toISOString() ?? null,
    paidAt: row?.paidAt?.toISOString() ?? null,
    locked,
    paid,
  };
}

export async function getOpenerPeriod(monthLabel: string) {
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) return null;
  return prisma.openerCommissionPeriod.findUnique({
    where: { monthLabel },
  });
}

export async function getOpenerPeriodView(
  monthLabel: string,
): Promise<OpenerPeriodView> {
  const row = await getOpenerPeriod(monthLabel);
  return openerPeriodViewFromRow(row, monthLabel);
}

export async function isOpenerMonthLocked(monthLabel: string): Promise<boolean> {
  const view = await getOpenerPeriodView(monthLabel);
  return view.locked;
}

export async function assertOpenerMonthOpen(
  monthLabel: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await isOpenerMonthLocked(monthLabel)) {
    return { ok: false, error: OPENER_PERIOD_LOCKED };
  }
  return { ok: true };
}

export async function assertOpenerLogMonthOpen(opts: {
  transferYmd?: string;
  logId?: string;
}): Promise<{ ok: true; monthLabel: string } | { ok: false; error: string }> {
  let monthLabel = opts.transferYmd ? openerPeriodFromYmd(opts.transferYmd) : "";
  if (!monthLabel && opts.logId) {
    const row = await prisma.openerTransferLog.findUnique({
      where: { id: opts.logId },
      select: { transferYmd: true },
    });
    monthLabel = row ? openerPeriodFromYmd(row.transferYmd) : "";
  }
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) {
    return { ok: false, error: "Invalid pay period." };
  }
  const open = await assertOpenerMonthOpen(monthLabel);
  if (!open.ok) return open;
  return { ok: true, monthLabel };
}

export async function closeOpenerPeriod(monthLabel: string) {
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) {
    return { ok: false as const, error: "Invalid pay period." };
  }
  const existing = await getOpenerPeriod(monthLabel);
  if (existing?.paidAt) {
    return { ok: false as const, error: "This period is already logged as paid." };
  }
  if (existing?.status === PeriodStatus.closed) {
    return { ok: false as const, error: "This period is already closed." };
  }
  const { syncOpenerLogCommissions } = await import("@/lib/opener/logs");
  await syncOpenerLogCommissions(monthLabel);
  await prisma.openerCommissionPeriod.upsert({
    where: { monthLabel },
    create: {
      monthLabel,
      status: PeriodStatus.closed,
      closedAt: new Date(),
    },
    update: {
      status: PeriodStatus.closed,
      closedAt: new Date(),
    },
  });
  return { ok: true as const };
}

export async function logOpenerPeriodAsPaid(opts: {
  monthLabel: string;
  paidById: string | null;
}) {
  const { monthLabel } = opts;
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) {
    return { ok: false as const, error: "Invalid pay period." };
  }
  const existing = await getOpenerPeriod(monthLabel);
  if (existing?.paidAt) {
    return { ok: false as const, error: "This period is already logged as paid." };
  }

  const [logs, upscores, openers] = await Promise.all([
    prisma.openerTransferLog.findMany({
      where: { transferYmd: { startsWith: monthLabel } },
      include: { agent: { select: { displayName: true } } },
      orderBy: [{ transferYmd: "asc" }, { forthId: "asc" }],
    }),
    prisma.openerPeriodUpscore.findMany({
      where: { monthLabel },
      include: { agent: { select: { displayName: true } } },
    }),
    listOpenerPlanAgents(),
  ]);
  const nameById = new Map(openers.map((o) => [o.id, o.displayName]));

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { syncOpenerLogCommissions } = await import("@/lib/opener/logs");
    await syncOpenerLogCommissions(monthLabel, tx);
    const period = await tx.openerCommissionPeriod.upsert({
      where: { monthLabel },
      create: {
        monthLabel,
        status: PeriodStatus.closed,
        closedAt: now,
        paidAt: now,
        paidById: opts.paidById,
      },
      update: {
        status: PeriodStatus.closed,
        closedAt: existing?.closedAt ?? now,
        paidAt: now,
        paidById: opts.paidById,
      },
    });

    await tx.openerPaidFile.deleteMany({ where: { periodId: period.id } });
    await tx.openerPaidUpscore.deleteMany({ where: { periodId: period.id } });

    if (logs.length) {
      await tx.openerPaidFile.createMany({
        data: logs.map((row) => ({
          periodId: period.id,
          agentId: row.agentId,
          openerName: row.agent.displayName,
          transferYmd: row.transferYmd,
          forthId: row.forthId,
          debtLoad: row.debtLoad,
          stageTitle: row.stageTitle,
          status: row.status,
          commission: openerCommissionForPayStatus(
            Number(row.debtLoad),
            row.payStatus as OpenerPayStatusName,
          ),
          payStatus: row.payStatus,
          notes: row.notes,
          unmatched: row.unmatched,
        })),
      });
    }

    if (upscores.length) {
      await tx.openerPaidUpscore.createMany({
        data: upscores.map((u) => ({
          periodId: period.id,
          agentId: u.agentId,
          openerName: u.agent.displayName || nameById.get(u.agentId) || "",
          amount: u.amount,
        })),
      });
    }
  });

  return { ok: true as const };
}

export async function openerMonthLockedSet(
  monthLabels: string[],
): Promise<Set<string>> {
  if (!monthLabels.length) return new Set();
  const rows = await prisma.openerCommissionPeriod.findMany({
    where: { monthLabel: { in: monthLabels } },
    select: { monthLabel: true, status: true, paidAt: true },
  });
  return new Set(
    rows
      .filter((r) => r.status === PeriodStatus.closed || r.paidAt)
      .map((r) => r.monthLabel),
  );
}
