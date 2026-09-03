/**
 * Openers have a separate transfer-pay plan. They keep a portal login (files,
 * Forth mapping, daily tasks) but are not included in ADP agent commission.
 */

import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { listDismissedKeys } from "@/lib/agents/dismissal";

/** Both opener logins sit on the opener transfer-pay plan, not ADP agent commission. */
export const OPENER_PLAN_ROLES: AgentRole[] = [
  AgentRole.opener,
  AgentRole.opener_manager,
];

export type OpenerPlanAgent = { id: string; displayName: string };

/**
 * List opener-plan users via SQL so a stale Prisma client (enum not in DMMF yet)
 * does not reject `opener_manager` in a `where.in`.
 */
export async function listOpenerPlanAgents(): Promise<OpenerPlanAgent[]> {
  return prisma.$queryRaw<OpenerPlanAgent[]>`
    SELECT id, "displayName"
    FROM "Agent"
    WHERE role::text IN ('opener', 'opener_manager')
    ORDER BY "displayName" ASC
  `;
}

export async function findOpenerPlanAgent(
  agentId: string,
): Promise<OpenerPlanAgent | null> {
  const rows = await prisma.$queryRaw<OpenerPlanAgent[]>`
    SELECT id, "displayName"
    FROM "Agent"
    WHERE id = ${agentId}
      AND role::text IN ('opener', 'opener_manager')
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function isOpenerPlanAgentId(agentId: string): Promise<boolean> {
  return Boolean(await findOpenerPlanAgent(agentId));
}

export async function listOpenerAliasKeys(): Promise<Set<string>> {
  try {
    const aliases = await prisma.$queryRaw<{ agentName: string }[]>`
      SELECT al."agentName" AS "agentName"
      FROM "AgentAlias" al
      INNER JOIN "Agent" a ON a.id = al."agentId"
      WHERE a.role::text IN ('opener', 'opener_manager')
    `;
    return new Set(aliases.map((a) => agentIdentityKey(a.agentName)));
  } catch {
    // Stale Prisma client or DB enum not migrated yet — treat as no openers.
    return new Set();
  }
}

/** Dismissed sales reps + opener aliases — hidden from commission pay. */
export async function listPayHiddenAliasKeys(): Promise<Set<string>> {
  const [dismissed, openers] = await Promise.all([
    listDismissedKeys(),
    listOpenerAliasKeys(),
  ]);
  return new Set([...dismissed, ...openers]);
}
