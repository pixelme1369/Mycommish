"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireManagerOrAdmin } from "@/lib/auth-guards";
import {
  OPENER_PAY_APPROVED,
  OPENER_PAY_EXCLUDED,
  openerPayStatusFromForthStatus,
} from "@/lib/opener/payout";
import { setOpenerLogNotes, setOpenerUpscore } from "@/lib/opener/logs";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

function revalidate(agentId: string) {
  revalidatePath("/portal");
  revalidatePath("/admin/openers");
  revalidatePath(`/admin/openers/${agentId}`);
  revalidatePath("/manager/openers");
  revalidatePath(`/manager/openers/${agentId}`);
}

export async function setOpenerPayStatusAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const value = String(formData.get("payStatus") || "");
  if (!id) return { ok: false, error: "Missing row." };

  const row = await prisma.openerTransferLog.findUnique({
    where: { id },
    select: { id: true, agentId: true, status: true },
  });
  if (!row) return { ok: false, error: "Row not found." };

  if (value === "auto") {
    await prisma.openerTransferLog.update({
      where: { id },
      data: {
        payStatus: openerPayStatusFromForthStatus(row.status),
        payStatusOverridden: false,
      },
    });
  } else if (value === OPENER_PAY_APPROVED || value === OPENER_PAY_EXCLUDED) {
    await prisma.openerTransferLog.update({
      where: { id },
      data: {
        payStatus: value,
        payStatusOverridden: true,
      },
    });
  } else {
    return { ok: false, error: "Invalid pay status." };
  }

  revalidate(row.agentId);
  return { ok: true };
}

export async function setOpenerUpscoreAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  const session = await requireManagerOrAdmin();
  const agentId = String(formData.get("agentId") || "");
  const monthLabel = String(formData.get("monthLabel") || "");
  const amountRaw = String(formData.get("amount") || "");
  if (!agentId) return { ok: false, error: "Missing opener." };

  const res = await setOpenerUpscore({
    agentId,
    monthLabel,
    amountRaw,
    updatedById: session.user.agentId ?? null,
  });
  if (!res.ok) return res;
  revalidate(agentId);
  return { ok: true };
}

export async function setOpenerLogNotesStaffAction(
  _prev: OpenerLogActionResult | null,
  formData: FormData,
): Promise<OpenerLogActionResult> {
  await requireManagerOrAdmin();
  const id = String(formData.get("id") || "");
  const notesRaw = String(formData.get("notes") || "");
  if (!id) return { ok: false, error: "Missing row." };

  const res = await setOpenerLogNotes({ id, notesRaw });
  if (!res.ok) return res;
  revalidate(res.agentId);
  return { ok: true };
}
