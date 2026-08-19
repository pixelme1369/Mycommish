"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireManagerOrAdmin, isAdminUser } from "@/lib/auth-guards";
import {
  createManagerBonus,
  deleteOwedBonus,
  markBonusReimbursed,
  markManagerBonusesReimbursed,
  undoBonusReimbursed,
  type BonusActionResult,
} from "@/lib/manager-bonuses";
import { parsePaidOnDate, periodLabelForNextPayDate } from "@/lib/manager-bonus-dates";

export type BonusFormState = BonusActionResult | null;

export async function createManagerBonusAction(
  _prev: BonusFormState,
  formData: FormData,
): Promise<BonusFormState> {
  const session = await requireManagerOrAdmin();
  const paidById = session.user.agentId;
  if (!paidById) return { ok: false, error: "Not signed in." };

  const recipientAgentId = String(formData.get("recipientAgentId") || "").trim() || null;
  const recipientName = String(formData.get("recipientName") || "").trim();
  const reason = String(formData.get("reason") || "");
  const amountRaw = String(formData.get("amount") || "").replace(/[$,]/g, "").trim();
  const amount = Number.parseFloat(amountRaw);
  const paidOnRaw = String(formData.get("paidOn") || "").trim();
  const paidOn = parsePaidOnDate(paidOnRaw);
  // Always attach to the next payday’s period — no client override.
  const periodLabel = periodLabelForNextPayDate();

  if (!paidOn) return { ok: false, error: "Paid on date is required." };

  const result = await createManagerBonus({
    paidById,
    recipientAgentId,
    recipientName,
    amount,
    reason,
    paidOn,
    periodLabel,
  });

  if (result.ok) {
    revalidatePath("/manager/bonuses");
    revalidatePath("/manager");
    revalidatePath("/admin");
    revalidatePath("/manager/periods", "layout");
    revalidatePath("/admin/periods", "layout");
  }
  return result;
}

export async function deleteManagerBonusAction(formData: FormData): Promise<void> {
  const session = await requireManagerOrAdmin();
  const paidById = session.user.agentId;
  if (!paidById) return;
  const bonusId = String(formData.get("bonusId") || "").trim();
  if (!bonusId) return;

  await deleteOwedBonus({
    bonusId,
    paidById,
    asAdmin: isAdminUser(session),
  });

  revalidatePath("/manager/bonuses");
  revalidatePath("/manager");
  revalidatePath("/manager/periods", "layout");
  revalidatePath("/admin/periods", "layout");
}

export async function markBonusReimbursedAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const reimbursedById = session.user.agentId;
  if (!reimbursedById) return;
  const bonusId = String(formData.get("bonusId") || "").trim();
  if (!bonusId) return;

  await markBonusReimbursed({ bonusId, reimbursedById });
  revalidatePath("/admin/periods", "layout");
  revalidatePath("/manager/periods", "layout");
  revalidatePath("/manager/bonuses");
  revalidatePath("/manager");
}

export async function markManagerPeriodBonusesReimbursedAction(
  formData: FormData,
): Promise<void> {
  const session = await requireAdmin();
  const reimbursedById = session.user.agentId;
  if (!reimbursedById) return;
  const periodLabel = String(formData.get("periodLabel") || "").trim();
  const paidById = String(formData.get("paidById") || "").trim();
  if (!periodLabel || !paidById) return;

  await markManagerBonusesReimbursed({ periodLabel, paidById, reimbursedById });
  revalidatePath("/admin/periods", "layout");
  revalidatePath("/manager/periods", "layout");
  revalidatePath("/manager/bonuses");
  revalidatePath("/manager");
}

export async function undoBonusReimbursedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const bonusId = String(formData.get("bonusId") || "").trim();
  if (!bonusId) return;

  await undoBonusReimbursed({ bonusId });
  revalidatePath("/admin/periods", "layout");
  revalidatePath("/manager/periods", "layout");
  revalidatePath("/manager/bonuses");
  revalidatePath("/manager");
}
