"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { dismissSalesRep, reinstateSalesRep } from "@/lib/agents/dismissal";

export async function dismissSalesRepAction(formData: FormData) {
  await requireAdmin();
  const agentName = String(formData.get("agentName") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  if (!agentName) return;
  await dismissSalesRep(agentName, note);
  revalidatePath("/admin");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/periods");
  revalidatePath("/portal");
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
