import { prisma } from "@/lib/db";
import { CONTRACTOR_COMPANIES } from "@/lib/agents/contractors";
import { AGENT_FIXED_RATES, agentIdentityKey } from "@/lib/commission/calculator";

/** Preferred CRM spellings for known fixed-rate / contractor reps. */
const KNOWN_SALES_REP_SPELLINGS: Record<string, string> = {
  "alex tambouly": "Alex Tambouly",
  "artin namjoo": "Artin Namjoo",
  "peter godwin": "Peter Godwin",
  "amir moayeri": "amir moayeri",
};

/**
 * Distinct CRM Sales Rep spellings for alias autocomplete.
 * Merges uploaded AgentPeriod / ClientEvent names with known contractor / fixed-rate reps.
 */
export async function listKnownSalesRepNames(): Promise<string[]> {
  const [fromPeriods, fromEvents, fromAliases] = await Promise.all([
    prisma.agentPeriod.findMany({
      select: { agentName: true },
      distinct: ["agentName"],
      orderBy: { agentName: "asc" },
    }),
    prisma.clientEvent.findMany({
      select: { agentName: true },
      distinct: ["agentName"],
      orderBy: { agentName: "asc" },
    }),
    prisma.agentAlias.findMany({
      select: { agentName: true },
      orderBy: { agentName: "asc" },
    }),
  ]);

  // key → preferred display spelling (prefer casing seen in CRM uploads)
  const byKey = new Map<string, string>();

  const add = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    const key = agentIdentityKey(n);
    const existing = byKey.get(key);
    // Prefer the longer / more “Title Case” looking CRM spelling when collision
    if (!existing || (n !== n.toLowerCase() && existing === existing.toLowerCase())) {
      byKey.set(key, n);
    } else if (!existing) {
      byKey.set(key, n);
    }
  };

  for (const r of fromPeriods) add(r.agentName);
  for (const r of fromEvents) add(r.agentName);
  for (const r of fromAliases) add(r.agentName);

  for (const key of Object.keys(CONTRACTOR_COMPANIES)) {
    if (!byKey.has(key)) add(KNOWN_SALES_REP_SPELLINGS[key] || key);
  }
  for (const key of Object.keys(AGENT_FIXED_RATES)) {
    if (!byKey.has(key)) add(KNOWN_SALES_REP_SPELLINGS[key] || key);
  }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
