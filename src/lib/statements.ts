import { prisma } from "@/lib/db";
import {
  buildAgentCommissionStatementPdf,
  type StatementSignatures,
} from "@/lib/export/agent-pdf";
import { PeriodSource, StatementSignStatus } from "@/generated/prisma/client";

function bytesToBuffer(value: Uint8Array | Buffer | null | undefined): Buffer | null {
  if (!value) return null;
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

export function parseSignatureDataUrl(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null;
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!m?.[1]) return null;
  try {
    const buf = Buffer.from(m[1], "base64");
    // Cap ~200KB — signature pads are tiny
    if (buf.length < 32 || buf.length > 200_000) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function getStatementForAgentPeriod(agentPeriodId: string) {
  return prisma.commissionStatement.findUnique({
    where: { agentPeriodId },
  });
}

/** Prefer live agentPeriod link; fall back to durable periodLabel + agentName. */
export async function getStatementForAgentPeriodRow(row: {
  id: string;
  agentName: string;
  period: { periodLabel: string };
}) {
  const linked = await prisma.commissionStatement.findUnique({
    where: { agentPeriodId: row.id },
  });
  if (linked) return linked;

  const durable = await prisma.commissionStatement.findUnique({
    where: {
      periodLabel_agentName: {
        periodLabel: row.period.periodLabel,
        agentName: row.agentName,
      },
    },
  });
  if (durable && durable.agentPeriodId !== row.id) {
    return prisma.commissionStatement.update({
      where: { id: durable.id },
      data: { agentPeriodId: row.id },
    });
  }
  return durable;
}

/**
 * After CRM recreates AgentPeriod rows, re-attach any signatures that survived
 * a period delete (keyed by periodLabel + agentName).
 */
export async function relinkCommissionStatements(opts: {
  periodLabel: string;
  agentPeriods: Array<{ id: string; agentName: string }>;
}) {
  for (const ap of opts.agentPeriods) {
    await prisma.commissionStatement.updateMany({
      where: {
        periodLabel: opts.periodLabel,
        agentName: ap.agentName,
      },
      data: { agentPeriodId: ap.id },
    });
  }
}

export async function signaturesFromRecord(
  statement: Awaited<ReturnType<typeof getStatementForAgentPeriod>>,
): Promise<StatementSignatures> {
  if (!statement) return {};
  return {
    agent: statement.agentSignedAt
      ? {
          typedName: statement.agentTypedName || "",
          signedAt: statement.agentSignedAt,
          png: bytesToBuffer(statement.agentSignaturePng),
        }
      : null,
    manager: statement.managerSignedAt
      ? {
          typedName: statement.managerTypedName || "",
          signedAt: statement.managerSignedAt,
          png: bytesToBuffer(statement.managerSignaturePng),
        }
      : null,
  };
}

export async function buildSignedStatementPdf(periodId: string, agentPeriodId: string) {
  const statement = await getStatementForAgentPeriod(agentPeriodId);
  const signatures = await signaturesFromRecord(statement);
  return buildAgentCommissionStatementPdf(periodId, agentPeriodId, signatures);
}

export function statementStatusLabel(status: StatementSignStatus | undefined | null) {
  switch (status) {
    case StatementSignStatus.fully_signed:
      return "Fully signed";
    case StatementSignStatus.agent_signed:
      return "Awaiting manager";
    default:
      return "Not signed";
  }
}

/**
 * AgentPeriod ids whose statements are fully signed (agent + manager).
 * Matches by live agentPeriodId and durable periodLabel + agentName.
 */
export async function fullySignedAgentPeriodIds(
  rows: Array<{ id: string; agentName: string; periodLabel: string }>,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!rows.length) return out;

  const ids = rows.map((r) => r.id);
  const byLink = await prisma.commissionStatement.findMany({
    where: {
      status: StatementSignStatus.fully_signed,
      agentPeriodId: { in: ids },
    },
    select: { agentPeriodId: true },
  });
  for (const r of byLink) {
    if (r.agentPeriodId) out.add(r.agentPeriodId);
  }

  const remaining = rows.filter((r) => !out.has(r.id));
  if (!remaining.length) return out;

  const durable = await prisma.commissionStatement.findMany({
    where: {
      status: StatementSignStatus.fully_signed,
      OR: remaining.map((r) => ({
        periodLabel: r.periodLabel,
        agentName: r.agentName,
      })),
    },
    select: { periodLabel: true, agentName: true },
  });
  const durableKeys = new Set(
    durable.map((r) => `${r.periodLabel}\0${r.agentName}`),
  );
  for (const r of remaining) {
    if (durableKeys.has(`${r.periodLabel}\0${r.agentName}`)) {
      out.add(r.id);
    }
  }
  return out;
}

/**
 * Map CRM agent name → whether the agent has signed (agent or fully signed).
 * Looks up by periodLabel (durable across CRM re-upload).
 */
export async function agentSignedByNameForPeriod(
  periodLabel: string,
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!periodLabel.trim()) return out;

  const rows = await prisma.commissionStatement.findMany({
    where: {
      periodLabel,
      agentSignedAt: { not: null },
      status: {
        in: [StatementSignStatus.agent_signed, StatementSignStatus.fully_signed],
      },
    },
    select: { agentName: true },
  });
  for (const r of rows) {
    out.set(r.agentName, true);
  }
  return out;
}

export type AwaitingManagerStatementRow = {
  statementId: string;
  agentPeriodId: string | null;
  periodId: string | null;
  periodLabel: string;
  agentName: string;
  netCommission: number;
  agentTypedName: string | null;
  agentSignedAt: Date;
};

/** Agent-signed statements waiting on manager/admin countersign. */
export async function listStatementsAwaitingManager(
  limit = 50,
): Promise<AwaitingManagerStatementRow[]> {
  const rows = await prisma.commissionStatement.findMany({
    where: {
      status: StatementSignStatus.agent_signed,
    },
    include: {
      agentPeriod: {
        include: { period: { select: { id: true, periodLabel: true, source: true } } },
      },
    },
    orderBy: { agentSignedAt: "asc" },
    take: limit,
  });

  return rows
    .filter((r) => r.agentSignedAt)
    .filter((r) => {
      // Prefer calculated-period rows; keep detached survivors (period deleted).
      const src = r.agentPeriod?.period.source;
      return !src || src === PeriodSource.calculated;
    })
    .map((r) => ({
      statementId: r.id,
      agentPeriodId: r.agentPeriodId,
      periodId: r.agentPeriod?.period.id ?? null,
      periodLabel: r.periodLabel || r.agentPeriod?.period.periodLabel || "—",
      agentName: r.agentName || r.agentPeriod?.agentName || "—",
      netCommission: Number(r.netAtAgentSign ?? r.agentPeriod?.netCommission ?? 0),
      agentTypedName: r.agentTypedName,
      agentSignedAt: r.agentSignedAt!,
    }));
}

export type FullySignedStatementRow = {
  statementId: string;
  agentPeriodId: string | null;
  periodId: string | null;
  periodLabel: string;
  agentName: string;
  netCommission: number;
  agentTypedName: string | null;
  managerTypedName: string | null;
  agentSignedAt: Date;
  managerSignedAt: Date;
};

/** Fully signed statements (agent + manager) for the admin archive. */
export async function listFullySignedStatements(
  opts?: { periodLabel?: string; limit?: number },
): Promise<FullySignedStatementRow[]> {
  const limit = opts?.limit ?? 200;
  const rows = await prisma.commissionStatement.findMany({
    where: {
      status: StatementSignStatus.fully_signed,
      ...(opts?.periodLabel ? { periodLabel: opts.periodLabel } : {}),
    },
    include: {
      agentPeriod: {
        include: { period: { select: { id: true, periodLabel: true, source: true } } },
      },
    },
    orderBy: [{ managerSignedAt: "desc" }, { agentSignedAt: "desc" }],
    take: limit,
  });

  return rows
    .filter((r) => r.agentSignedAt && r.managerSignedAt)
    .filter((r) => {
      const src = r.agentPeriod?.period.source;
      return !src || src === PeriodSource.calculated;
    })
    .map((r) => ({
      statementId: r.id,
      agentPeriodId: r.agentPeriodId,
      periodId: r.agentPeriod?.period.id ?? null,
      periodLabel: r.periodLabel || r.agentPeriod?.period.periodLabel || "—",
      agentName: r.agentName || r.agentPeriod?.agentName || "—",
      netCommission: Number(r.netAtAgentSign ?? r.agentPeriod?.netCommission ?? 0),
      agentTypedName: r.agentTypedName,
      managerTypedName: r.managerTypedName,
      agentSignedAt: r.agentSignedAt!,
      managerSignedAt: r.managerSignedAt!,
    }));
}

/** Count of fully signed statements per period label (newest period first). */
export async function countFullySignedStatementsByPeriod(): Promise<
  { periodLabel: string; count: number }[]
> {
  const groups = await prisma.commissionStatement.groupBy({
    by: ["periodLabel"],
    where: {
      status: StatementSignStatus.fully_signed,
      agentSignedAt: { not: null },
      managerSignedAt: { not: null },
    },
    _count: { _all: true },
    orderBy: { periodLabel: "desc" },
  });
  return groups.map((g) => ({
    periodLabel: g.periodLabel,
    count: g._count._all,
  }));
}
