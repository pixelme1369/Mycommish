"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireSuperAdmin } from "@/lib/auth-guards";
import {
  approveManualBonus,
  createManualBonus,
  deletePendingManualBonus,
  updatePendingManualBonus,
  type ManualBonusActionResult,
} from "@/lib/manual-bonuses";

export type ManualBonusFormState = ManualBonusActionResult | null;

function revalidateAgentPeriod(periodId: string, agentPeriodId: string) {
  revalidatePath(`/portal/period/${periodId}/agent/${agentPeriodId}`);
  revalidatePath(`/admin/periods/${periodId}`);
  revalidatePath(`/manager/periods/${periodId}`);
  revalidatePath("/portal");
  revalidatePath("/admin");
  revalidatePath("/superadmin/manual-bonuses");
  revalidatePath("/manager");
}

export async function createManualBonusAction(
  _prev: ManualBonusFormState,
  formData: FormData,
): Promise<ManualBonusFormState> {
  const session = await requireManager();
  const createdById = session.user.agentId;
  if (!createdById) return { ok: false, error: "Not signed in." };

  const agentPeriodId = String(formData.get("agentPeriodId") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  const note = String(formData.get("note") || "");
  const amountRaw = String(formData.get("amount") || "").replace(/[$,]/g, "").trim();
  const amount = Number.parseFloat(amountRaw);

  if (!agentPeriodId) return { ok: false, error: "Missing agent period." };

  const result = await createManualBonus({
    agentPeriodId,
    createdById,
    amount,
    note,
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/superadmin/manual-bonuses");
    if (periodId) revalidateAgentPeriod(periodId, agentPeriodId);
  }
  return result;
}

export async function updateManualBonusAction(
  _prev: ManualBonusFormState,
  formData: FormData,
): Promise<ManualBonusFormState> {
  const session = await requireManager();
  const actorId = session.user.agentId;
  if (!actorId) return { ok: false, error: "Not signed in." };

  const bonusId = String(formData.get("bonusId") || "").trim();
  const agentPeriodId = String(formData.get("agentPeriodId") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  const note = String(formData.get("note") || "");
  const amountRaw = String(formData.get("amount") || "").replace(/[$,]/g, "").trim();
  const amount = Number.parseFloat(amountRaw);

  if (!bonusId) return { ok: false, error: "Missing bonus." };

  const result = await updatePendingManualBonus({
    bonusId,
    actorId,
    amount,
    note,
  });
  if (result.ok && periodId && agentPeriodId) {
    revalidateAgentPeriod(periodId, agentPeriodId);
  } else if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/superadmin/manual-bonuses");
  }
  return result;
}

export async function deleteManualBonusAction(formData: FormData): Promise<void> {
  await requireManager();
  const bonusId = String(formData.get("bonusId") || "").trim();
  const agentPeriodId = String(formData.get("agentPeriodId") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!bonusId) return;

  await deletePendingManualBonus({ bonusId });
  revalidatePath("/admin");
  revalidatePath("/superadmin/manual-bonuses");
  if (periodId && agentPeriodId) revalidateAgentPeriod(periodId, agentPeriodId);
}

export async function approveManualBonusAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdmin();
  const approvedById = session.user.agentId;
  if (!approvedById) return;

  const bonusId = String(formData.get("bonusId") || "").trim();
  if (!bonusId) return;

  const result = await approveManualBonus({ bonusId, approvedById });
  revalidatePath("/admin");
  revalidatePath("/superadmin/manual-bonuses");
  if (result.ok && result.periodId && result.agentPeriodId) {
    revalidateAgentPeriod(result.periodId, result.agentPeriodId);
  }
}
