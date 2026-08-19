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

export type AwaitingManagerStatementRow = {
  statementId: string;
  agentPeriodId: string;
  periodId: string;
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
      agentPeriod: { period: { source: PeriodSource.calculated } },
    },
    include: {
      agentPeriod: {
        include: { period: { select: { id: true, periodLabel: true } } },
      },
    },
    orderBy: { agentSignedAt: "asc" },
    take: limit,
  });

  return rows
    .filter((r) => r.agentSignedAt)
    .map((r) => ({
      statementId: r.id,
      agentPeriodId: r.agentPeriodId,
      periodId: r.agentPeriod.period.id,
      periodLabel: r.agentPeriod.period.periodLabel,
      agentName: r.agentPeriod.agentName,
      netCommission: Number(r.netAtAgentSign ?? r.agentPeriod.netCommission),
      agentTypedName: r.agentTypedName,
      agentSignedAt: r.agentSignedAt!,
    }));
}

export type FullySignedStatementRow = {
  statementId: string;
  agentPeriodId: string;
  periodId: string;
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
      agentPeriod: {
        period: {
          source: PeriodSource.calculated,
          ...(opts?.periodLabel ? { periodLabel: opts.periodLabel } : {}),
        },
      },
    },
    include: {
      agentPeriod: {
        include: { period: { select: { id: true, periodLabel: true } } },
      },
    },
    orderBy: [{ managerSignedAt: "desc" }, { agentSignedAt: "desc" }],
    take: limit,
  });

  return rows
    .filter((r) => r.agentSignedAt && r.managerSignedAt)
    .map((r) => ({
      statementId: r.id,
      agentPeriodId: r.agentPeriodId,
      periodId: r.agentPeriod.period.id,
      periodLabel: r.agentPeriod.period.periodLabel,
      agentName: r.agentPeriod.agentName,
      netCommission: Number(r.netAtAgentSign ?? r.agentPeriod.netCommission),
      agentTypedName: r.agentTypedName,
      managerTypedName: r.managerTypedName,
      agentSignedAt: r.agentSignedAt!,
      managerSignedAt: r.managerSignedAt!,
    }));
}
