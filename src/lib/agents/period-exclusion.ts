/**
 * Period-scoped exclusions: hide an agent from one calculated month’s
 * pay list / Gusto / exports without global dismiss.
 * Durable across CRM wipe (periodLabel + agentNameKey).
 */

import { prisma } from "@/lib/db";
import { agentIdentityKey } from "@/lib/commission/calculator";

export function exclusionKey(agentName: string) {
  return agentIdentityKey(agentName);
}

export async function listExcludedKeysForPeriod(
  periodLabel: string,
): Promise<Set<string>> {
  const rows = await prisma.periodAgentExclusion.findMany({
    where: { periodLabel },
    select: { agentNameKey: true },
  });
  return new Set(rows.map((r) => r.agentNameKey));
}

export async function excludeAgentFromPeriod(opts: {
  periodLabel: string;
  agentName: string;
  createdById?: string | null;
  note?: string | null;
}) {
  const trimmed = opts.agentName.trim();
  if (!trimmed || !opts.periodLabel.trim()) return;

  await prisma.periodAgentExclusion.upsert({
    where: {
      periodLabel_agentNameKey: {
        periodLabel: opts.periodLabel.trim(),
        agentNameKey: exclusionKey(trimmed),
      },
    },
    create: {
      periodLabel: opts.periodLabel.trim(),
      agentNameKey: exclusionKey(trimmed),
      agentName: trimmed,
      note: opts.note?.trim() || null,
      createdById: opts.createdById || null,
    },
    update: {
      agentName: trimmed,
      note: opts.note?.trim() || null,
      createdById: opts.createdById || null,
    },
  });
}

export async function includeAgentInPeriod(opts: {
  periodLabel: string;
  agentName: string;
}) {
  const trimmed = opts.agentName.trim();
  if (!trimmed || !opts.periodLabel.trim()) return;

  await prisma.periodAgentExclusion.deleteMany({
    where: {
      periodLabel: opts.periodLabel.trim(),
      agentNameKey: exclusionKey(trimmed),
    },
  });
}
