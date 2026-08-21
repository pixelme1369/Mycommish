import { prisma } from "@/lib/db";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { PeriodSource } from "@/generated/prisma/client";
import { listKnownSalesRepNames } from "@/lib/agents/sales-reps";
import type { CommissionLinkHit } from "@/lib/agents/link-commission-format";

export type { CommissionLinkHit } from "@/lib/agents/link-commission-format";
export { formatCommissionLinkSummary } from "@/lib/agents/link-commission-format";

/**
 * Map candidate spellings to exact CRM Sales Rep names when known.
 * When `onlyKnown` is true, drop names that do not appear in CRM/known lists.
 */
export async function resolveCrmAliasSpellings(
  candidates: string[],
  opts?: { onlyKnown?: boolean },
): Promise<string[]> {
  const known = await listKnownSalesRepNames();
  const byKey = new Map(known.map((n) => [agentIdentityKey(n), n]));

  const out = new Map<string, string>();
  for (const raw of candidates) {
    const n = raw.trim();
    if (!n) continue;
    const key = agentIdentityKey(n);
    const crm = byKey.get(key);
    if (crm) {
      out.set(agentIdentityKey(crm), crm);
    } else if (!opts?.onlyKnown) {
      out.set(key, n);
    }
  }
  return [...out.values()];
}

/** Calculated AgentPeriod rows already in the DB for these Sales Rep names. */
export async function findCommissionLinksForAliases(
  aliasNames: string[],
): Promise<CommissionLinkHit[]> {
  const names = [...new Set(aliasNames.map((n) => n.trim()).filter(Boolean))];
  if (!names.length) return [];

  const rows = await prisma.agentPeriod.findMany({
    where: {
      OR: names.map((n) => ({
        agentName: { equals: n, mode: "insensitive" as const },
      })),
      period: { source: PeriodSource.calculated },
    },
    select: {
      agentName: true,
      netCommission: true,
      period: { select: { periodLabel: true } },
    },
    orderBy: [{ period: { periodLabel: "desc" } }, { agentName: "asc" }],
    take: 20,
  });

  return rows.map((r) => ({
    periodLabel: r.period.periodLabel,
    agentName: r.agentName,
    netCommission: Number(r.netCommission),
  }));
}
