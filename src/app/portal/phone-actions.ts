"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/auth-guards";
import { normalizeAgentPhone } from "@/lib/agents/phone";

export type SavePhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

/** Logged-in agent saves their own mobile on the Agent row (Neon). */
export async function saveOwnPhoneAction(
  _prev: SavePhoneResult | null,
  formData: FormData,
): Promise<SavePhoneResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  let phone: string | null;
  try {
    phone = normalizeAgentPhone(String(formData.get("phone") || ""));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid phone number.",
    };
  }
  if (!phone) {
    return { ok: false, error: "Mobile number is required." };
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: { phone },
  });

  revalidatePath("/portal");
  revalidatePath("/admin/agents");
  return { ok: true, phone };
}

/** Admin updates any agent’s phone from Users. */
export async function updateAgentPhoneAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;

  let phone: string | null;
  try {
    phone = normalizeAgentPhone(String(formData.get("phone") || ""));
  } catch {
    return;
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: { phone },
  });
  revalidatePath("/admin/agents");
}
