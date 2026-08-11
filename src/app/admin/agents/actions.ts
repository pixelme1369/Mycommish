"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { contractorCompanyFor } from "@/lib/agents/contractors";
import { AgentRole, EmploymentType } from "@/generated/prisma/client";

function parseRole(raw: FormDataEntryValue | null): AgentRole {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "admin") return AgentRole.admin;
  if (v === "manager") return AgentRole.manager;
  return AgentRole.agent;
}

export async function createAgentAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const role = parseRole(formData.get("role"));
  const password = String(formData.get("password") || "");
  const isContractor = formData.get("isContractor") === "on";
  const companyName = String(formData.get("companyName") || "").trim() || null;
  if (!email || !displayName) return;

  const knownCompany = contractorCompanyFor(displayName);
  const employmentType =
    isContractor || knownCompany ? EmploymentType.contractor : EmploymentType.employee;

  const passwordHash =
    password.trim().length >= 6 ? await bcrypt.hash(password.trim(), 10) : undefined;

  await prisma.agent.create({
    data: {
      email,
      displayName,
      role,
      isAdmin: role === AgentRole.admin,
      employmentType,
      companyName:
        employmentType === EmploymentType.contractor ? companyName || knownCompany : null,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  revalidatePath("/admin/agents");
}

export async function setPasswordAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const password = String(formData.get("password") || "");
  if (!agentId) return;
  if (password.trim().length < 6) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: { passwordHash: await bcrypt.hash(password.trim(), 10) },
  });
  revalidatePath("/admin/agents");
}

export async function clearPasswordAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: { passwordHash: null },
  });
  revalidatePath("/admin/agents");
}

export async function updateRoleAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const role = parseRole(formData.get("role"));
  if (!agentId) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      role,
      isAdmin: role === AgentRole.admin,
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

export async function suspendAgentAction(formData: FormData) {
  const session = await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;
  if (session.user.agentId === agentId) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      suspendedAt: new Date(),
      suspendedById: session.user.agentId || null,
    },
  });
  revalidatePath("/admin/agents");
}

export async function activateAgentAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      suspendedAt: null,
      suspendedById: null,
    },
  });
  revalidatePath("/admin/agents");
}
