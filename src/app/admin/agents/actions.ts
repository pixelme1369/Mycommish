"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { contractorCompanyFor } from "@/lib/agents/contractors";
import { EmploymentType } from "@/generated/prisma/client";

export async function createAgentAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const isAdmin = formData.get("isAdmin") === "on";
  const isContractor = formData.get("isContractor") === "on";
  const companyName = String(formData.get("companyName") || "").trim() || null;
  if (!email || !displayName) return;

  const knownCompany = contractorCompanyFor(displayName);
  const employmentType =
    isContractor || knownCompany ? EmploymentType.contractor : EmploymentType.employee;

  await prisma.agent.create({
    data: {
      email,
      displayName,
      isAdmin,
      employmentType,
      companyName:
        employmentType === EmploymentType.contractor ? companyName || knownCompany : null,
    },
  });
  revalidatePath("/admin/agents");
}

export async function updateEmploymentAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const isContractor = formData.get("isContractor") === "on";
  const companyName = String(formData.get("companyName") || "").trim() || null;
  if (!agentId) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      employmentType: isContractor ? EmploymentType.contractor : EmploymentType.employee,
      companyName: isContractor ? companyName : null,
    },
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

  const company = contractorCompanyFor(agentName);
  if (company) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { employmentType: EmploymentType.contractor, companyName: company },
    });
  }

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
