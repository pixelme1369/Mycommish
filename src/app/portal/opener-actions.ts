"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpener } from "@/lib/auth-guards";
import { normalizeForthId } from "@/lib/opener/payout";
import {
  existingOpenerLog,
  lookupForthForOpener,
  matchedDebtTooLow,
  setOpenerLogNotes,
} from "@/lib/opener/logs";
import { assertOpenerLogMonthOpen, assertOpenerMonthOpen } from "@/lib/opener/period";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type { OpenerLogActionResult };

function revalidateOpenerPaths(agentId: string) {
  revalidatePath("/portal");
  revalidatePath("/admin/openers");
  revalidatePath(`/admin/openers/${agentId}`);
  revalidatePath("/manager/openers");
  revalidatePath(`/manager/openers/${agentId}`);
}

export async function createOpenerLogAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const forthId = normalizeForthId(String(formData.get("forthId") || ""));
  const transferYmd = String(formData.get("transferYmd") || "").trim();
  if (!forthId) return { ok: false, error: "File ID is required." };
  if (!YMD.test(transferYmd)) return { ok: false, error: "Pick a valid date." };

  const monthGate = await assertOpenerMonthOpen(transferYmd.slice(0, 7));
  if (!monthGate.ok) return monthGate;

  const existing = await existingOpenerLog(forthId);
  if (existing) {
    return {
      ok: false,
      error:
        existing.agentId === agentId
          ? "You already logged this File ID."
          : `This File ID is already logged (${existing.agent.displayName}).`,
    };
  }

  const snap = await lookupForthForOpener(forthId);
  if (matchedDebtTooLow(snap)) {
    return {
      ok: false,
      error: "Debt load must be at least $5,000 to log this file.",
    };
  }

  await prisma.openerTransferLog.create({
    data: {
      agentId,
      forthId,
      transferYmd,
      debtLoad: snap.debtLoad,
      stageTitle: snap.stageTitle,
      status: snap.status,
      commission: snap.commission,
      payStatus: snap.payStatus,
      unmatched: snap.unmatched,
    },
  });

  revalidateOpenerPaths(agentId);
  return {
    ok: true,
    warning: snap.unmatched
      ? "File ID is not in Forth yet. Stage, status, and debt load will fill in on the next Forth sync."
      : undefined,
  };
}

export async function updateOpenerLogDateAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const id = String(formData.get("id") || "");
  const transferYmd = String(formData.get("transferYmd") || "").trim();
  if (!id) return { ok: false, error: "Missing row." };
  if (!YMD.test(transferYmd)) return { ok: false, error: "Pick a valid date." };

  const nextMonth = await assertOpenerMonthOpen(transferYmd.slice(0, 7));
  if (!nextMonth.ok) return nextMonth;
  const currentMonth = await assertOpenerLogMonthOpen({ logId: id });
  if (!currentMonth.ok) return currentMonth;

  const row = await prisma.openerTransferLog.findFirst({
    where: { id, agentId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "That row is not yours." };

  await prisma.openerTransferLog.update({
    where: { id },
    data: { transferYmd },
  });
  revalidateOpenerPaths(agentId);
  return { ok: true };
}

export async function deleteOpenerLogAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "Missing row." };

  const monthGate = await assertOpenerLogMonthOpen({ logId: id });
  if (!monthGate.ok) return monthGate;

  const row = await prisma.openerTransferLog.findFirst({
    where: { id, agentId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "That row is not yours." };

  await prisma.openerTransferLog.delete({ where: { id } });
  revalidateOpenerPaths(agentId);
  return { ok: true };
}

export async function updateOpenerLogNotesAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const id = String(formData.get("id") || "");
  const notesRaw = String(formData.get("notes") || "");
  if (!id) return { ok: false, error: "Missing row." };

  const monthGate = await assertOpenerLogMonthOpen({ logId: id });
  if (!monthGate.ok) return monthGate;

  const res = await setOpenerLogNotes({ id, notesRaw, agentId });
  if (!res.ok) return res;
  revalidateOpenerPaths(agentId);
  return { ok: true };
}
