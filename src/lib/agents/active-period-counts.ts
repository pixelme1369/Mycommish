/**
 * Active AgentPeriod counts for dashboard lists — excludes globally
 * dismissed sales reps and period-scoped removals.
 */

import { prisma } from "@/lib/db";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { listDismissedKeys } from "@/lib/agents/dismissal";

export async function countActiveAgentsByPeriod(
  periods: Array<{ id: string; periodLabel: string }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (periods.length === 0) return out;

  const periodIds = periods.map((p) => p.id);
  const labels = [...new Set(periods.map((p) => p.periodLabel))];
  for (const id of periodIds) out.set(id, 0);

  const [dismissedKeys, exclusions, agentRows] = await Promise.all([
    listDismissedKeys(),
    prisma.periodAgentExclusion.findMany({
      where: { periodLabel: { in: labels } },
      select: { periodLabel: true, agentNameKey: true },
    }),
    prisma.agentPeriod.findMany({
      where: { periodId: { in: periodIds } },
      select: { periodId: true, agentName: true },
    }),
  ]);

  const excludedByLabel = new Map<string, Set<string>>();
  for (const e of exclusions) {
    let set = excludedByLabel.get(e.periodLabel);
    if (!set) {
      set = new Set();
      excludedByLabel.set(e.periodLabel, set);
    }
    set.add(e.agentNameKey);
  }

  const labelById = new Map(periods.map((p) => [p.id, p.periodLabel]));

  for (const ap of agentRows) {
    const label = labelById.get(ap.periodId);
    if (!label) continue;
    const key = agentIdentityKey(ap.agentName);
    if (dismissedKeys.has(key)) continue;
    if (excludedByLabel.get(label)?.has(key)) continue;
    out.set(ap.periodId, (out.get(ap.periodId) ?? 0) + 1);
  }

  return out;
}
