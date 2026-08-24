"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  canViewAllCommissions,
  requireSession,
} from "@/lib/auth-guards";
import { parseSignatureDataUrl } from "@/lib/statements";
import { PeriodSource, StatementSignStatus } from "@/generated/prisma/client";

function pngOrNull(dataUrl: string | null | undefined): Uint8Array<ArrayBuffer> | null {
  const buf = parseSignatureDataUrl(dataUrl);
  if (!buf) return null;
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy;
}

export type SignResult = { ok: true } | { ok: false; error: string };

async function loadCalculatedAgentPeriod(periodId: string, agentPeriodId: string) {
  return prisma.agentPeriod.findFirst({
    where: {
      id: agentPeriodId,
      periodId,
      period: { source: PeriodSource.calculated },
    },
    include: { period: true },
  });
}

/** Legal name on the PDF — always the signed-in account display name (not client-typed). */
function lockedSignerName(session: Awaited<ReturnType<typeof requireSession>>) {
  return (session.user.displayName || "").trim();
}

/** Agent e-signs their own period statement (first signature). */
export async function signStatementAsAgentAction(input: {
  periodId: string;
  agentPeriodId: string;
  /** Ignored — name is locked to the signed-in account. */
  typedName?: string;
  signatureDataUrl?: string | null;
}): Promise<SignResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const typedName = lockedSignerName(session);
  if (typedName.length < 2) {
    return { ok: false, error: "Your account needs a full name before you can sign." };
  }

  const row = await loadCalculatedAgentPeriod(input.periodId, input.agentPeriodId);
  if (!row) return { ok: false, error: "Period not found." };

  const aliases = new Set((session.user.aliasNames || []).map((n) => n.toLowerCase()));
  const ownsRow = aliases.has(row.agentName.toLowerCase());
  if (!ownsRow) {
    return { ok: false, error: "You can only sign your own commission statement." };
  }

  const existing = await prisma.commissionStatement.findUnique({
    where: {
      periodLabel_agentName: {
        periodLabel: row.period.periodLabel,
        agentName: row.agentName,
      },
    },
  });
  if (existing?.agentSignedAt) {
    return { ok: false, error: "You already signed this statement." };
  }

  const png = pngOrNull(input.signatureDataUrl);
  const now = new Date();

  await prisma.commissionStatement.upsert({
    where: {
      periodLabel_agentName: {
        periodLabel: row.period.periodLabel,
        agentName: row.agentName,
      },
    },
    create: {
      periodLabel: row.period.periodLabel,
      agentName: row.agentName,
      agentPeriodId: row.id,
      status: StatementSignStatus.agent_signed,
      agentTypedName: typedName,
      agentSignaturePng: png ?? undefined,
      agentSignedAt: now,
      agentSignedById: agentId,
      netAtAgentSign: row.netCommission,
    },
    update: {
      agentPeriodId: row.id,
      status: StatementSignStatus.agent_signed,
      agentTypedName: typedName,
      agentSignaturePng: png,
      agentSignedAt: now,
      agentSignedById: agentId,
      netAtAgentSign: row.netCommission,
      // clear manager if re-signing somehow — agent already blocked above
    },
  });

  revalidatePath(`/portal/period/${input.periodId}/agent/${input.agentPeriodId}`);
  revalidatePath(`/admin/periods/${input.periodId}`);
  revalidatePath(`/manager/periods/${input.periodId}`);
  revalidatePath("/admin");
  revalidatePath("/manager");
  return { ok: true };
}

/** Manager or admin countersigns after the agent. */
export async function signStatementAsManagerAction(input: {
  periodId: string;
  agentPeriodId: string;
  /** Ignored — name is locked to the signed-in account. */
  typedName?: string;
  signatureDataUrl?: string | null;
}): Promise<SignResult> {
  const session = await requireSession();
  if (!canViewAllCommissions(session)) {
    return { ok: false, error: "Only a manager or admin can countersign." };
  }
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const typedName = lockedSignerName(session);
  if (typedName.length < 2) {
    return { ok: false, error: "Your account needs a full name before you can sign." };
  }

  const row = await loadCalculatedAgentPeriod(input.periodId, input.agentPeriodId);
  if (!row) return { ok: false, error: "Period not found." };

  const existing = await prisma.commissionStatement.findUnique({
    where: {
      periodLabel_agentName: {
        periodLabel: row.period.periodLabel,
        agentName: row.agentName,
      },
    },
  });
  if (!existing?.agentSignedAt) {
    return { ok: false, error: "Agent must sign before the manager." };
  }
  if (existing.managerSignedAt) {
    return { ok: false, error: "Manager already signed this statement." };
  }

  const png = pngOrNull(input.signatureDataUrl);
  const now = new Date();

  await prisma.commissionStatement.update({
    where: { id: existing.id },
    data: {
      agentPeriodId: row.id,
      status: StatementSignStatus.fully_signed,
      managerTypedName: typedName,
      managerSignaturePng: png,
      managerSignedAt: now,
      managerSignedById: agentId,
    },
  });

  revalidatePath(`/portal/period/${input.periodId}/agent/${input.agentPeriodId}`);
  revalidatePath(`/admin/periods/${input.periodId}`);
  revalidatePath(`/manager/periods/${input.periodId}`);
  revalidatePath("/admin");
  revalidatePath("/manager");
  return { ok: true };
}

/** Clear signatures so someone can sign again (accidental sign). */
export async function resetStatementSignaturesAction(input: {
  periodId: string;
  agentPeriodId: string;
}): Promise<SignResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const row = await loadCalculatedAgentPeriod(input.periodId, input.agentPeriodId);
  if (!row) return { ok: false, error: "Period not found." };

  const existing = await prisma.commissionStatement.findUnique({
    where: {
      periodLabel_agentName: {
        periodLabel: row.period.periodLabel,
        agentName: row.agentName,
      },
    },
  });
  if (!existing || existing.status === StatementSignStatus.unsigned) {
    return { ok: false, error: "Nothing to reset." };
  }

  const aliases = new Set((session.user.aliasNames || []).map((n) => n.toLowerCase()));
  const ownsRow = aliases.has(row.agentName.toLowerCase());
  const staff = canViewAllCommissions(session);

  if (!staff && !ownsRow) {
    return { ok: false, error: "You can only reset your own statement." };
  }
  // Agents may undo only before manager countersigns.
  if (!staff && existing.status === StatementSignStatus.fully_signed) {
    return {
      ok: false,
      error: "This statement is fully signed. Ask a manager or admin to reset it.",
    };
  }

  await prisma.commissionStatement.update({
    where: { id: existing.id },
    data: {
      agentPeriodId: row.id,
      status: StatementSignStatus.unsigned,
      agentTypedName: null,
      agentSignaturePng: null,
      agentSignedAt: null,
      agentSignedById: null,
      netAtAgentSign: null,
      managerTypedName: null,
      managerSignaturePng: null,
      managerSignedAt: null,
      managerSignedById: null,
    },
  });

  revalidatePath(`/portal/period/${input.periodId}/agent/${input.agentPeriodId}`);
  revalidatePath(`/admin/periods/${input.periodId}`);
  revalidatePath(`/manager/periods/${input.periodId}`);
  revalidatePath("/admin");
  revalidatePath("/manager");
  return { ok: true };
}
