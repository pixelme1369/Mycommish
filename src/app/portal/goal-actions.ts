"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-guards";
import { pacificTodayYmd, workingYmdsInMonth } from "@/lib/portal/daily-tasks-dates";
import { parseDebtInput, parseUnitsPerDay } from "@/lib/portal/monthly-goal-math";
import { saveEnrolledGoal } from "@/lib/portal/monthly-goal";

export type SaveGoalResult = { ok: true } | { ok: false; error: string };

export async function saveMonthlyGoalAction(
  _prev: SaveGoalResult | null,
  formData: FormData,
): Promise<SaveGoalResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const monthLabel = pacificTodayYmd().slice(0, 7);
  const debtGoal = parseDebtInput(String(formData.get("debtGoal") || "")) ?? 0;
  const unitsPerDay = parseUnitsPerDay(String(formData.get("unitsPerDay") || ""));
  if (debtGoal <= 0 && (unitsPerDay == null || unitsPerDay <= 0)) {
    return { ok: false, error: "Set an enrolled $ goal, units per day, or both." };
  }

  const workingDays = workingYmdsInMonth(monthLabel).length;
  const unitsGoal =
    unitsPerDay && unitsPerDay > 0 ? unitsPerDay * Math.max(1, workingDays) : 0;

  await saveEnrolledGoal({ agentId, monthLabel, debtGoal, unitsGoal });
  revalidatePath("/portal");
  revalidatePath("/portal/goals");
  return { ok: true };
}
