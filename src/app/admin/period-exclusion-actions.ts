"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import {
  excludeAgentFromPeriod,
  includeAgentInPeriod,
} from "@/lib/agents/period-exclusion";

export async function excludeAgentFromPeriodAction(formData: FormData) {
  const session = await requireAdmin();
  const agentName = String(formData.get("agentName") || "").trim();
  const periodLabel = String(formData.get("periodLabel") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  if (!agentName || !periodLabel) return;

  await excludeAgentFromPeriod({
    periodLabel,
    agentName,
    createdById: session.user.agentId,
    note,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/periods");
  if (periodId) revalidatePath(`/admin/periods/${periodId}`);
  revalidatePath("/manager/periods");
  if (periodId) revalidatePath(`/manager/periods/${periodId}`);
}

export async function includeAgentInPeriodAction(formData: FormData) {
  await requireAdmin();
  const agentName = String(formData.get("agentName") || "").trim();
  const periodLabel = String(formData.get("periodLabel") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!agentName || !periodLabel) return;

  await includeAgentInPeriod({ periodLabel, agentName });

  revalidatePath("/admin");
  revalidatePath("/admin/periods");
  if (periodId) revalidatePath(`/admin/periods/${periodId}`);
  revalidatePath("/manager/periods");
  if (periodId) revalidatePath(`/manager/periods/${periodId}`);
}
