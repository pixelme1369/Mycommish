"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import {
  deleteTeamLead,
  upsertTeamLead,
  type TeamLeadBonusScopeName,
} from "@/lib/teams/team-lead-bonus";

export async function saveTeamLeadAction(formData: FormData) {
  await requireAdmin();
  const leadAgentId = String(formData.get("leadAgentId") || "").trim();
  const leadAgentName = String(formData.get("leadAgentName") || "").trim();
  const rateRaw = String(formData.get("ratePerUnit") || "5").trim();
  const ratePerUnit = Number.parseFloat(rateRaw);
  const bonusScopeRaw = String(formData.get("bonusScope") || "roster").trim();
  const bonusScope: TeamLeadBonusScopeName =
    bonusScopeRaw === "all_period_units" ? "all_period_units" : "roster";
  const memberNames = formData
    .getAll("memberNames")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (!leadAgentId) return { ok: false as const, error: "Pick a team lead." };

  const res = await upsertTeamLead({
    leadAgentId,
    leadAgentName,
    ratePerUnit: Number.isFinite(ratePerUnit) ? ratePerUnit : 5,
    bonusScope,
    memberNames,
  });

  revalidatePath("/admin/teams");
  revalidatePath("/superadmin/team-leads");
  revalidatePath("/admin");
  revalidatePath("/admin/periods");
  return res;
}

export async function deleteTeamLeadAction(formData: FormData) {
  await requireAdmin();
  const teamLeadId = String(formData.get("teamLeadId") || "").trim();
  if (!teamLeadId) return { ok: false as const, error: "Missing team lead." };

  const res = await deleteTeamLead(teamLeadId);
  revalidatePath("/admin/teams");
  revalidatePath("/superadmin/team-leads");
  revalidatePath("/admin");
  revalidatePath("/admin/periods");
  return res;
}
