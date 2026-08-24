/**
 * Resolve / backfill Agent.gusto* fields from the static Gusto roster
 * (matched via CRM aliases + display name).
 */

import { prisma } from "@/lib/db";
import { findEmployeeRoster } from "@/lib/gusto/roster";

export type AgentGustoProfile = {
  gustoFirstName: string | null;
  gustoLastName: string | null;
  gustoEmployeeId: string | null;
};

export function resolveGustoProfileFromNames(
  names: string[],
): AgentGustoProfile | null {
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const row = findEmployeeRoster(trimmed);
    if (row?.gustoEmployeeId) {
      return {
        gustoFirstName: row.firstName || null,
        gustoLastName: row.lastName || null,
        gustoEmployeeId: row.gustoEmployeeId,
      };
    }
  }
  return null;
}

/** Fill empty gusto fields for one agent from roster. Returns true if updated. */
export async function fillAgentGustoIfEmpty(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { aliases: { select: { agentName: true } } },
  });
  if (!agent) return false;
  if (agent.gustoEmployeeId?.trim()) return false;

  const resolved = resolveGustoProfileFromNames([
    ...agent.aliases.map((a) => a.agentName),
    agent.displayName,
  ]);
  if (!resolved) return false;

  await prisma.agent.update({
    where: { id: agentId },
    data: resolved,
  });
  return true;
}

/** Backfill every agent missing a gusto employee id. */
export async function backfillAllAgentGustoProfiles(): Promise<{
  updated: number;
  skipped: number;
}> {
  const agents = await prisma.agent.findMany({
    include: { aliases: { select: { agentName: true } } },
  });
  let updated = 0;
  let skipped = 0;
  for (const agent of agents) {
    if (agent.gustoEmployeeId?.trim()) {
      skipped += 1;
      continue;
    }
    const resolved = resolveGustoProfileFromNames([
      ...agent.aliases.map((a) => a.agentName),
      agent.displayName,
    ]);
    if (!resolved) {
      skipped += 1;
      continue;
    }
    await prisma.agent.update({
      where: { id: agent.id },
      data: resolved,
    });
    updated += 1;
  }
  return { updated, skipped };
}
