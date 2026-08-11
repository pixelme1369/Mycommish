/**
 * Soft-dismiss CRM Sales Reps from active commission UI + Gusto.
 * Does not delete ledger / AgentPeriod history.
 */

import { prisma } from "@/lib/db";
import { agentIdentityKey } from "@/lib/commission/calculator";

export function dismissalKey(agentName: string) {
  return agentIdentityKey(agentName);
}

export async function listDismissedKeys(): Promise<Set<string>> {
  const rows = await prisma.salesRepDismissal.findMany({
    select: { agentNameKey: true },
  });
  return new Set(rows.map((r) => r.agentNameKey));
}

export async function listDismissals() {
  return prisma.salesRepDismissal.findMany({
    orderBy: [{ dismissedAt: "desc" }, { agentName: "asc" }],
  });
}

export async function isSalesRepDismissed(agentName: string): Promise<boolean> {
  const row = await prisma.salesRepDismissal.findUnique({
    where: { agentNameKey: dismissalKey(agentName) },
    select: { id: true },
  });
  return Boolean(row);
}

/** Dismiss this CRM name and any sibling aliases on the same Agent login. */
export async function dismissSalesRep(agentName: string, note?: string | null) {
  const key = dismissalKey(agentName);
  const trimmed = agentName.trim();
  if (!trimmed) return;

  const alias = await prisma.agentAlias.findFirst({
    where: { agentName: { equals: trimmed, mode: "insensitive" } },
    include: { agent: { include: { aliases: true } } },
  });

  const names = alias
    ? alias.agent.aliases.map((a) => a.agentName)
    : [trimmed];

  for (const name of names) {
    await prisma.salesRepDismissal.upsert({
      where: { agentNameKey: dismissalKey(name) },
      create: {
        agentNameKey: dismissalKey(name),
        agentName: name.trim(),
        note: note?.trim() || null,
      },
      update: {
        agentName: name.trim(),
        note: note?.trim() || null,
        dismissedAt: new Date(),
      },
    });
  }
}

export async function reinstateSalesRep(agentName: string) {
  const trimmed = agentName.trim();
  if (!trimmed) return;

  const alias = await prisma.agentAlias.findFirst({
    where: { agentName: { equals: trimmed, mode: "insensitive" } },
    include: { agent: { include: { aliases: true } } },
  });

  const keys = alias
    ? alias.agent.aliases.map((a) => dismissalKey(a.agentName))
    : [dismissalKey(trimmed)];

  await prisma.salesRepDismissal.deleteMany({
    where: { agentNameKey: { in: keys } },
  });
}

export function filterOutDismissed<T extends { agentName: string }>(
  rows: T[],
  dismissed: Set<string>,
): T[] {
  return rows.filter((r) => !dismissed.has(dismissalKey(r.agentName)));
}
