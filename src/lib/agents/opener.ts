/**
 * Openers have a separate transfer-pay plan. They keep a portal login (files,
 * Forth mapping, daily tasks) but are not included in ADP agent commission.
 */

import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { listDismissedKeys } from "@/lib/agents/dismissal";

export async function listOpenerAliasKeys(): Promise<Set<string>> {
  try {
    const aliases = await prisma.agentAlias.findMany({
      where: { agent: { role: AgentRole.opener } },
      select: { agentName: true },
    });
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
