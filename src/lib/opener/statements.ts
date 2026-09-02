import { prisma } from "@/lib/db";
import { Prisma, StatementSignStatus } from "@/generated/prisma/client";
import { canAgentSignStatementForPeriod } from "@/lib/commission/calculator";
import { parseSignatureDataUrl } from "@/lib/statements";
import { listOpenerSummaries } from "@/lib/opener/logs";

function pngOrNull(dataUrl: string | null | undefined) {
  const buf = parseSignatureDataUrl(dataUrl);
  if (!buf) return null;
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy;
}

export type OpenerStatementView = {
  id: string | null;
  status: "unsigned" | "agent_signed" | "fully_signed";
  agentSignedAt: string | null;
  agentTypedName: string | null;
  managerSignedAt: string | null;
  managerTypedName: string | null;
  totalPayout: number | null;
};

export async function getOpenerStatement(agentId: string, monthLabel: string) {
  return prisma.openerCommissionStatement.findUnique({
    where: { agentId_monthLabel: { agentId, monthLabel } },
  });
}

export function openerStatementViewFromRow(
  row: Awaited<ReturnType<typeof getOpenerStatement>>,
): OpenerStatementView {
  return {
    id: row?.id ?? null,
    status: row?.status ?? "unsigned",
    agentSignedAt: row?.agentSignedAt?.toISOString() ?? null,
    agentTypedName: row?.agentTypedName ?? null,
    managerSignedAt: row?.managerSignedAt?.toISOString() ?? null,
    managerTypedName: row?.managerTypedName ?? null,
    totalPayout: row?.totalPayout != null ? Number(row.totalPayout) : null,
  };
}

async function payoutSnapshot(agentId: string, monthLabel: string) {
  const rows = await listOpenerSummaries(monthLabel);
  const row = rows.find((r) => r.agentId === agentId);
  return {
    approvedTransfers: row?.approvedTransfers ?? 0,
    commissionTotal: row?.commissionTotal ?? 0,
    upscore: row?.upscore ?? 0,
    totalPayout: row?.totalPayout ?? 0,
  };
}

export async function signOpenerStatementAsOpener(opts: {
  agentId: string;
  monthLabel: string;
  typedName: string;
  signatureDataUrl?: string | null;
}) {
  if (!/^\d{4}-\d{2}$/.test(opts.monthLabel)) {
    return { ok: false as const, error: "Invalid pay period." };
  }
  if (opts.typedName.trim().length < 2) {
    return { ok: false as const, error: "Your account needs a full name before you can sign." };
  }
  if (!canAgentSignStatementForPeriod(opts.monthLabel)) {
    return { ok: false as const, error: "Too early to sign for this commission period." };
  }

  const existing = await getOpenerStatement(opts.agentId, opts.monthLabel);
  if (existing?.agentSignedAt) {
    return { ok: false as const, error: "You already signed this statement." };
  }

  const snap = await payoutSnapshot(opts.agentId, opts.monthLabel);
  const png = pngOrNull(opts.signatureDataUrl);
  const now = new Date();

  await prisma.openerCommissionStatement.upsert({
    where: { agentId_monthLabel: { agentId: opts.agentId, monthLabel: opts.monthLabel } },
    create: {
      agentId: opts.agentId,
      monthLabel: opts.monthLabel,
      status: StatementSignStatus.agent_signed,
      approvedTransfers: snap.approvedTransfers,
      commissionTotal: new Prisma.Decimal(snap.commissionTotal),
      upscore: new Prisma.Decimal(snap.upscore),
      totalPayout: new Prisma.Decimal(snap.totalPayout),
      agentTypedName: opts.typedName.trim(),
      agentSignaturePng: png ?? undefined,
      agentSignedAt: now,
      agentSignedById: opts.agentId,
    },
    update: {
      status: StatementSignStatus.agent_signed,
      approvedTransfers: snap.approvedTransfers,
      commissionTotal: new Prisma.Decimal(snap.commissionTotal),
      upscore: new Prisma.Decimal(snap.upscore),
      totalPayout: new Prisma.Decimal(snap.totalPayout),
      agentTypedName: opts.typedName.trim(),
      agentSignaturePng: png,
      agentSignedAt: now,
      agentSignedById: opts.agentId,
    },
  });
  return { ok: true as const };
}

export async function signOpenerStatementAsManager(opts: {
  openerAgentId: string;
  monthLabel: string;
  managerAgentId: string;
  typedName: string;
  signatureDataUrl?: string | null;
}) {
  if (opts.typedName.trim().length < 2) {
    return { ok: false as const, error: "Your account needs a full name before you can sign." };
  }
  const existing = await getOpenerStatement(opts.openerAgentId, opts.monthLabel);
  if (!existing?.agentSignedAt) {
    return { ok: false as const, error: "Opener must sign before the manager." };
  }
  if (existing.managerSignedAt) {
    return { ok: false as const, error: "Manager already signed this statement." };
  }
  const png = pngOrNull(opts.signatureDataUrl);
  await prisma.openerCommissionStatement.update({
    where: { id: existing.id },
    data: {
      status: StatementSignStatus.fully_signed,
      managerTypedName: opts.typedName.trim(),
      managerSignaturePng: png,
      managerSignedAt: new Date(),
      managerSignedById: opts.managerAgentId,
    },
  });
  return { ok: true as const };
}

export async function resetOpenerStatementSignatures(opts: {
  openerAgentId: string;
  monthLabel: string;
}) {
  const existing = await getOpenerStatement(opts.openerAgentId, opts.monthLabel);
  if (!existing || existing.status === StatementSignStatus.unsigned) {
    return { ok: false as const, error: "Nothing to reset." };
  }
  await prisma.openerCommissionStatement.update({
    where: { id: existing.id },
    data: {
      status: StatementSignStatus.unsigned,
      approvedTransfers: null,
      commissionTotal: null,
      upscore: null,
      totalPayout: null,
      agentTypedName: null,
      agentSignaturePng: null,
      agentSignedAt: null,
      agentSignedById: null,
      managerTypedName: null,
      managerSignaturePng: null,
      managerSignedAt: null,
      managerSignedById: null,
    },
  });
  return { ok: true as const };
}

export type OpenerAwaitingManagerRow = {
  statementId: string;
  agentId: string;
  agentName: string;
  periodLabel: string;
  netCommission: number;
  agentTypedName: string | null;
  agentSignedAt: Date;
};

export async function listOpenerStatementsAwaitingManager(
  limit = 50,
): Promise<OpenerAwaitingManagerRow[]> {
  const rows = await prisma.openerCommissionStatement.findMany({
    where: { status: StatementSignStatus.agent_signed },
    include: { agent: { select: { displayName: true } } },
    orderBy: { agentSignedAt: "asc" },
    take: limit,
  });
  return rows
    .filter((r) => r.agentSignedAt)
    .map((r) => ({
      statementId: r.id,
      agentId: r.agentId,
      agentName: r.agent.displayName,
      periodLabel: r.monthLabel,
      netCommission: Number(r.totalPayout ?? 0),
      agentTypedName: r.agentTypedName,
      agentSignedAt: r.agentSignedAt!,
    }));
}

export async function openerStatementStatusByAgent(
  monthLabel: string,
): Promise<Map<string, StatementSignStatus>> {
  const rows = await prisma.openerCommissionStatement.findMany({
    where: { monthLabel },
    select: { agentId: true, status: true },
  });
  return new Map(rows.map((r) => [r.agentId, r.status]));
}
