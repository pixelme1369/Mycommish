"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";

export async function createAgentAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const isAdmin = formData.get("isAdmin") === "on";
  if (!email || !displayName) return;

  await prisma.agent.create({
    data: { email, displayName, isAdmin },
  });
  revalidatePath("/admin/agents");
}

export async function addAliasAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const agentName = String(formData.get("agentName") || "").trim();
  if (!agentId || !agentName) return;

  await prisma.agentAlias.create({
    data: { agentId, agentName },
  });
  revalidatePath("/admin/agents");
}

export async function deleteAliasAction(formData: FormData) {
  await requireAdmin();
  const aliasId = String(formData.get("aliasId") || "");
  if (!aliasId) return;
  await prisma.agentAlias.delete({ where: { id: aliasId } });
  revalidatePath("/admin/agents");
}

export async function deleteAgentAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;
  await prisma.agent.delete({ where: { id: agentId } });
  revalidatePath("/admin/agents");
}

export async function listAgents() {
  return prisma.agent.findMany({
    include: { aliases: { orderBy: { agentName: "asc" } } },
    orderBy: { displayName: "asc" },
  });
}
