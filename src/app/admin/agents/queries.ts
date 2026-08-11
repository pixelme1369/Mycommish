import { prisma } from "@/lib/db";

export async function listAgents() {
  return prisma.agent.findMany({
    include: {
      aliases: { orderBy: { agentName: "asc" } },
      suspendedBy: { select: { displayName: true } },
    },
    orderBy: { displayName: "asc" },
  });
}
