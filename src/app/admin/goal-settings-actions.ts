"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parseClearRatePct } from "@/lib/portal/monthly-goal-math";
import { saveGoalClearRatePct } from "@/lib/portal/goal-settings";

export type SaveGoalSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveGoalClearRateAction(
  _prev: SaveGoalSettingsResult | null,
  formData: FormData,
): Promise<SaveGoalSettingsResult> {
  await requireAdmin();
  const parsed = parseClearRatePct(String(formData.get("clearRate") || ""));
  if (parsed == null) {
    return { ok: false, error: "Enter a clear rate between 1 and 100." };
  }
  await saveGoalClearRatePct(parsed);
  revalidatePath("/admin/manual-inputs");
  revalidatePath("/portal");
  revalidatePath("/portal/goals");
  return { ok: true };
}
