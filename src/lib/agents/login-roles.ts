import { prisma } from "@/lib/db";
import { dismissalKey } from "@/lib/agents/dismissal";

/** Portal login role for each CRM Sales Rep name (alias), if mapped. */
export async function loginRolesByAgentName(
  names: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  const aliases = await prisma.agentAlias.findMany({
    where: {
      OR: unique.map((n) => ({
        agentName: { equals: n, mode: "insensitive" as const },
      })),
    },
    select: {
      agentName: true,
      agent: { select: { role: true } },
    },
  });

  const map = new Map<string, string>();
  for (const row of aliases) {
    map.set(dismissalKey(row.agentName), row.agent.role);
  }
  return map;
}
