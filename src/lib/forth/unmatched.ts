import { prisma } from "@/lib/db";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { agentIdentityKey } from "@/lib/commission/calculator";
import {
  filterForthMapUsers,
  filterUnmatchedForthNames,
} from "@/lib/forth/unmatched-match";

export type UnmatchedForthName = {
  assignedTo: string;
  fileCount: number;
};

export type ForthMapUser = {
  id: string;
  displayName: string;
  role: string;
  aliases: string[];
};

export async function listUnmatchedForthNames(): Promise<UnmatchedForthName[]> {
  const [result, dismissed] = await Promise.all([
    prisma.forthContact.groupBy({
      by: ["assignedTo"],
      where: { agentId: null, assignedTo: { not: null } },
      _count: true,
    }),
    listDismissedKeys(),
  ]);
  return filterUnmatchedForthNames(
    result
      .map((r) => ({
        assignedTo: (r.assignedTo || "").trim(),
        fileCount: r._count,
      }))
      .filter((r) => r.assignedTo),
    dismissed,
  ).sort((a, b) => a.assignedTo.localeCompare(b.assignedTo));
}

export async function listForthMapUsers(): Promise<ForthMapUser[]> {
  const [agents, dismissed] = await Promise.all([
    prisma.agent.findMany({
      where: { suspendedAt: null },
      select: {
        id: true,
        displayName: true,
        role: true,
        aliases: { select: { agentName: true }, orderBy: { agentName: "asc" } },
      },
      orderBy: { displayName: "asc" },
    }),
    listDismissedKeys(),
  ]);
  return filterForthMapUsers(
    agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      role: a.role,
      aliases: a.aliases.map((x) => x.agentName),
    })),
    dismissed,
  );
}

export async function backfillForthContactsForAlias(
  agentId: string,
  agentName: string,
): Promise<number> {
  const name = agentName.trim();
  if (!name) return 0;
  const result = await prisma.forthContact.updateMany({
    where: {
      agentId: null,
      assignedTo: { equals: name, mode: "insensitive" },
    },
    data: { agentId },
  });
  return result.count;
}

export async function attachForthAssignedToUser(opts: {
  assignedTo: string;
  agentId: string;
}): Promise<{ filesLinked: number; aliasAdded: boolean }> {
  const name = opts.assignedTo.trim();
  if (!name) throw new Error("Forth name is required.");

  const dismissed = await listDismissedKeys();
  if (dismissed.has(agentIdentityKey(name))) {
    throw new Error("That sales rep is dismissed — nothing to map.");
  }

  const agent = await prisma.agent.findUnique({
    where: { id: opts.agentId },
    select: { id: true, suspendedAt: true },
  });
  if (!agent || agent.suspendedAt) {
    throw new Error("Choose an active user.");
  }

  const existing = await prisma.agentAlias.findFirst({
    where: { agentName: { equals: name, mode: "insensitive" } },
    select: { agentId: true, agentName: true },
  });
  if (existing && existing.agentId !== opts.agentId) {
    throw new Error(`“${existing.agentName}” is already mapped to another user.`);
  }

  let aliasAdded = false;
  if (!existing) {
    await prisma.agentAlias.create({
      data: { agentId: opts.agentId, agentName: name },
    });
    aliasAdded = true;
  }

  const filesLinked = await backfillForthContactsForAlias(opts.agentId, name);
  return { filesLinked, aliasAdded };
}
