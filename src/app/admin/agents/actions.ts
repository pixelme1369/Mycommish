"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { contractorCompanyFor } from "@/lib/agents/contractors";
import {
  formatCommissionLinkSummary,
  findCommissionLinksForAliases,
  resolveCrmAliasSpellings,
} from "@/lib/agents/link-commission";
import { AgentRole, EmploymentType } from "@/generated/prisma/client";
import { fillAgentGustoIfEmpty } from "@/lib/gusto/sync-agent-profiles";
import {
  attachForthAssignedToUser,
  backfillForthContactsForAlias,
} from "@/lib/forth/unmatched";

function parseRole(raw: FormDataEntryValue | null): AgentRole {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "super_admin") return AgentRole.super_admin;
  if (v === "admin") return AgentRole.admin;
  if (v === "manager") return AgentRole.manager;
  return AgentRole.agent;
}

function isAdminFlagForRole(role: AgentRole): boolean {
  return role === AgentRole.admin || role === AgentRole.super_admin;
}

function revalidateAgentPortal() {
  revalidatePath("/admin/agents");
  revalidatePath("/portal");
  revalidatePath("/portal/files");
  revalidatePath("/portal/goals");
  revalidatePath("/admin");
  revalidatePath("/manager");
}

export type CreateAgentResult =
  | { ok: true; message: string; aliases: string[] }
  | { ok: false; error: string };

export async function createAgentAction(
  _prev: CreateAgentResult | null,
  formData: FormData,
): Promise<CreateAgentResult> {
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const role = parseRole(formData.get("role"));
  const password = String(formData.get("password") || "");
  const isContractor = formData.get("isContractor") === "on";
  const companyName = String(formData.get("companyName") || "").trim() || null;
  if (!email || !displayName) {
    return { ok: false, error: "Email and display name are required." };
  }

  const existing = await prisma.agent.findUnique({
    where: { email },
    select: { id: true, displayName: true, suspendedAt: true, role: true },
  });
  if (existing) {
    if (existing.suspendedAt) {
      return {
        ok: false,
        error: `That email already belongs to suspended user “${existing.displayName}”. Unsuspend them on this page instead of creating a duplicate.`,
      };
    }
    return {
      ok: false,
      error: `That email is already used by “${existing.displayName}” (${existing.role}). Edit that user instead.`,
    };
  }

  const formAliases = formData
    .getAll("alias")
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const [fromForm, fromDisplay] = await Promise.all([
    resolveCrmAliasSpellings(formAliases),
    resolveCrmAliasSpellings([displayName], { onlyKnown: true }),
  ]);
  const aliasNames = await resolveCrmAliasSpellings([...fromForm, ...fromDisplay]);

  const knownCompany =
    contractorCompanyFor(displayName) ||
    aliasNames.map((n) => contractorCompanyFor(n)).find(Boolean) ||
    null;
  const employmentType =
    isContractor || knownCompany ? EmploymentType.contractor : EmploymentType.employee;

  const passwordHash =
    password.trim().length >= 6 ? await bcrypt.hash(password.trim(), 10) : undefined;

  let createdId = "";
  try {
    const agent = await prisma.agent.create({
      data: {
        email,
        displayName,
        role,
        isAdmin: isAdminFlagForRole(role),
        employmentType,
        companyName:
          employmentType === EmploymentType.contractor ? companyName || knownCompany : null,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    createdId = agent.id;

    if (aliasNames.length > 0) {
      await prisma.agentAlias.createMany({
        data: aliasNames.map((agentName) => ({ agentId: agent.id, agentName })),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      return { ok: false, error: "That email is already registered." };
    }
    throw err;
  }

  if (createdId) {
    await fillAgentGustoIfEmpty(createdId).catch(() => false);
  }

  const hits = await findCommissionLinksForAliases(aliasNames);
  const linkSummary = formatCommissionLinkSummary(hits);
  const aliasBit =
    aliasNames.length > 0
      ? `Aliases: ${aliasNames.join(", ")}. `
      : "No CRM aliases yet — add a Sales Rep spelling so they can see commission. ";

  revalidateAgentPortal();
  return {
    ok: true,
    aliases: aliasNames,
    message: `User created. ${aliasBit}${linkSummary}`,
  };
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
      isAdmin: isAdminFlagForRole(role),
    },
  });
  revalidatePath("/admin/agents");
}

export async function updateDisplayNameAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  if (!agentId || !displayName) return;

  await prisma.agent.update({
    where: { id: agentId },
    data: { displayName },
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

export async function updateGustoProfileAction(formData: FormData) {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) return;

  const gustoFirstName = String(formData.get("gustoFirstName") || "").trim() || null;
  const gustoLastName = String(formData.get("gustoLastName") || "").trim() || null;
  const gustoEmployeeId = String(formData.get("gustoEmployeeId") || "").trim() || null;

  await prisma.agent.update({
    where: { id: agentId },
    data: { gustoFirstName, gustoLastName, gustoEmployeeId },
  });
  revalidatePath("/admin/agents");
}

export type AddAliasResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function addAliasAction(
  _prev: AddAliasResult | null,
  formData: FormData,
): Promise<AddAliasResult> {
  await requireAdmin();
  const agentId = String(formData.get("agentId") || "");
  const rawName = String(formData.get("agentName") || "").trim();
  if (!agentId || !rawName) {
    return { ok: false, error: "Sales Rep name is required." };
  }

  const [agentName] = await resolveCrmAliasSpellings([rawName]);
  if (!agentName) {
    return { ok: false, error: "Sales Rep name is required." };
  }

  try {
    await prisma.agentAlias.create({
      data: { agentId, agentName },
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      return { ok: false, error: `Alias “${agentName}” is already mapped to a user.` };
    }
    throw err;
  }

  const company = contractorCompanyFor(agentName);
  if (company) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { employmentType: EmploymentType.contractor, companyName: company },
    });
  }

  await fillAgentGustoIfEmpty(agentId).catch(() => false);
  const forthLinked = await backfillForthContactsForAlias(agentId, agentName);

  const hits = await findCommissionLinksForAliases([agentName]);
  const linkSummary = formatCommissionLinkSummary(hits);
  const forthBit =
    forthLinked > 0
      ? ` Linked ${forthLinked} Forth file${forthLinked === 1 ? "" : "s"}.`
      : "";

  revalidateAgentPortal();
  return {
    ok: true,
    message: `Alias “${agentName}” added. ${linkSummary}${forthBit}`,
  };
}

export type MapForthResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function mapForthAssignedToAction(
  assignedTo: string,
  agentId: string,
): Promise<MapForthResult> {
  await requireAdmin();
  const name = assignedTo.trim();
  const id = agentId.trim();
  if (!name || !id) {
    return { ok: false, error: "Choose a user." };
  }

  try {
    const { filesLinked } = await attachForthAssignedToUser({
      assignedTo: name,
      agentId: id,
    });
    revalidateAgentPortal();
    return {
      ok: true,
      message: `Mapped “${name}” · ${filesLinked} file${filesLinked === 1 ? "" : "s"} linked.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not map that name.",
    };
  }
}

export async function deleteAliasAction(formData: FormData) {
  await requireAdmin();
  const aliasId = String(formData.get("aliasId") || "");
  if (!aliasId) return;
  await prisma.agentAlias.delete({ where: { id: aliasId } });
  revalidateAgentPortal();
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
