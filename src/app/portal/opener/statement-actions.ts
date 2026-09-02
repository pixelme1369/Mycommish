"use server";

import { revalidatePath } from "next/cache";
import {
  canViewAllCommissions,
  requireSession,
} from "@/lib/auth-guards";
import { isOpenerRole } from "@/lib/roles";
import {
  resetOpenerStatementSignatures,
  signOpenerStatementAsManager,
  signOpenerStatementAsOpener,
} from "@/lib/opener/statements";

export type OpenerSignResult = { ok: true } | { ok: false; error: string };

function lockedSignerName(session: Awaited<ReturnType<typeof requireSession>>) {
  return (session.user.displayName || "").trim();
}

function revalidate(agentId: string, monthLabel: string) {
  revalidatePath("/portal");
  revalidatePath(`/portal/opener/statement/${agentId}`);
  revalidatePath("/admin/openers");
  revalidatePath(`/admin/openers/${agentId}`);
  revalidatePath("/manager/openers");
  revalidatePath(`/manager/openers/${agentId}`);
  revalidatePath("/admin");
  revalidatePath("/manager");
  void monthLabel;
}

export async function signOpenerStatementAsOpenerAction(input: {
  openerAgentId: string;
  monthLabel: string;
  signatureDataUrl?: string | null;
}): Promise<OpenerSignResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };
  if (!isOpenerRole(session.user.role) || agentId !== input.openerAgentId) {
    return { ok: false, error: "You can only sign your own opener statement." };
  }
  const res = await signOpenerStatementAsOpener({
    agentId,
    monthLabel: input.monthLabel,
    typedName: lockedSignerName(session),
    signatureDataUrl: input.signatureDataUrl,
  });
  if (!res.ok) return res;
  revalidate(agentId, input.monthLabel);
  return { ok: true };
}

export async function signOpenerStatementAsManagerAction(input: {
  openerAgentId: string;
  monthLabel: string;
  signatureDataUrl?: string | null;
}): Promise<OpenerSignResult> {
  const session = await requireSession();
  if (!canViewAllCommissions(session)) {
    return { ok: false, error: "Only a manager or admin can countersign." };
  }
  const managerId = session.user.agentId;
  if (!managerId) return { ok: false, error: "Not signed in." };
  const res = await signOpenerStatementAsManager({
    openerAgentId: input.openerAgentId,
    monthLabel: input.monthLabel,
    managerAgentId: managerId,
    typedName: lockedSignerName(session),
    signatureDataUrl: input.signatureDataUrl,
  });
  if (!res.ok) return res;
  revalidate(input.openerAgentId, input.monthLabel);
  return { ok: true };
}

export async function resetOpenerStatementSignaturesAction(input: {
  openerAgentId: string;
  monthLabel: string;
}): Promise<OpenerSignResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const staff = canViewAllCommissions(session);
  const own = isOpenerRole(session.user.role) && agentId === input.openerAgentId;
  if (!staff && !own) {
    return { ok: false, error: "You can only reset your own statement." };
  }

  const { getOpenerStatement } = await import("@/lib/opener/statements");
  const existing = await getOpenerStatement(input.openerAgentId, input.monthLabel);
  if (!staff && existing?.status === "fully_signed") {
    return {
      ok: false,
      error: "This statement is fully signed. Ask a manager or admin to reset it.",
    };
  }

  const res = await resetOpenerStatementSignatures({
    openerAgentId: input.openerAgentId,
    monthLabel: input.monthLabel,
  });
  if (!res.ok) return res;
  revalidate(input.openerAgentId, input.monthLabel);
  return { ok: true };
}
