/**
 * Openers have a separate transfer-pay plan. They keep a portal login (files,
 * Forth mapping, daily tasks) but are not included in ADP agent commission.
 */

import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { listDismissedKeys } from "@/lib/agents/dismissal";

export { openerIdForTransferAgent } from "@/lib/agents/opener-match";

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

/**
 * Map Forth Transfer Agent display names (and opener aliases) → opener agentId.
 * Ambiguous names (two openers share a spelling) are omitted.
 */
export async function listOpenerTransferAgentIdByName(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();

  function put(name: string, agentId: string) {
    const key = agentIdentityKey(name);
    if (!key || !agentId) return;
    if (ambiguous.has(key)) return;
    const prev = map.get(key);
    if (prev && prev !== agentId) {
      map.delete(key);
      ambiguous.add(key);
      return;
    }
    map.set(key, agentId);
  }

  try {
    const [agents, aliases] = await Promise.all([
      listOpenerPlanAgents(),
      prisma.$queryRaw<{ agentName: string; agentId: string }[]>`
        SELECT al."agentName" AS "agentName", al."agentId" AS "agentId"
        FROM "AgentAlias" al
        INNER JOIN "Agent" a ON a.id = al."agentId"
        WHERE a.role::text IN ('opener', 'opener_manager')
      `,
    ]);
    for (const a of agents) put(a.displayName, a.id);
    for (const al of aliases) put(al.agentName, al.agentId);
  } catch {
    return new Map();
  }
  return map;
}

/** Dismissed sales reps + opener aliases — hidden from commission pay. */
export async function listPayHiddenAliasKeys(): Promise<Set<string>> {
  const [dismissed, openers] = await Promise.all([
    listDismissedKeys(),
    listOpenerAliasKeys(),
  ]);
  return new Set([...dismissed, ...openers]);
}
