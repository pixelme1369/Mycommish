"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { dismissSalesRep, reinstateSalesRep } from "@/lib/agents/dismissal";
import {
  loadLastCheckPreview,
  resolveLastCheckAgentPeriodId,
  type LastCheckPreview,
} from "@/lib/agents/last-check-load";

export async function previewLastCheckAction(
  agentPeriodId: string,
): Promise<LastCheckPreview | null> {
  await requireAdmin();
  const id = agentPeriodId.trim();
  if (!id) return null;
  return loadLastCheckPreview(id);
}

export async function dismissSalesRepAction(formData: FormData): Promise<{
  ok: true;
  agentPeriodId: string | null;
}> {
  await requireAdmin();
  const agentName = String(formData.get("agentName") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  const agentPeriodId = String(formData.get("agentPeriodId") || "").trim() || null;
  if (!agentName) return { ok: true, agentPeriodId };
  await dismissSalesRep(agentName, note);
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/periods");
  revalidatePath("/portal");
  return { ok: true, agentPeriodId };
}

export async function resolveLastCheckPeriodAction(agentName: string): Promise<string | null> {
  await requireAdmin();
  return resolveLastCheckAgentPeriodId(agentName);
}

export async function reinstateSalesRepAction(formData: FormData) {
  await requireAdmin();
  const agentName = String(formData.get("agentName") || "").trim();
  if (!agentName) return;
  await reinstateSalesRep(agentName);
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/periods");
  revalidatePath("/portal");
}
