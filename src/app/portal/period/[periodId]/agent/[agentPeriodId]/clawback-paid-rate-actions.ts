"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth-guards";
import {
  setClawbackPaidRate,
  setClearedPaidRateForCrmId,
  type SetClawbackPaidRateResult,
} from "@/lib/portal/clawback-paid-rate";

export type ClawbackPaidRateFormState = SetClawbackPaidRateResult | null;

function revalidateAgentPeriod(periodId: string, agentPeriodId: string) {
  revalidatePath(`/portal/period/${periodId}/agent/${agentPeriodId}`);
  revalidatePath(`/admin/periods/${periodId}`);
  revalidatePath(`/manager/periods/${periodId}`);
  revalidatePath("/portal");
  revalidatePath("/admin");
}

export async function setClawbackPaidRateAction(
  _prev: ClawbackPaidRateFormState,
  formData: FormData,
): Promise<ClawbackPaidRateFormState> {
  const session = await requireSuperAdmin();
  const clientEventId = String(formData.get("clientEventId") || "").trim();
  const crmId = String(formData.get("crmId") || "").trim();
  const cordobaOnly = String(formData.get("cordobaOnly") || "") === "true";
  const ratePercentInput = String(formData.get("ratePercent") || "");
  const periodId = String(formData.get("periodId") || "").trim();
  const agentPeriodId = String(formData.get("agentPeriodId") || "").trim();
  const actorLabel = session.user.displayName || session.user.email || "super admin";

  const result = cordobaOnly
    ? await setClearedPaidRateForCrmId({
        crmId,
        ratePercentInput,
        actorLabel,
      })
    : await setClawbackPaidRate({
        clientEventId,
        ratePercentInput,
        actorLabel,
      });

  if (result.ok && periodId && agentPeriodId) {
    revalidateAgentPeriod(periodId, agentPeriodId);
  }
  return result;
}
