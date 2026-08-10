/**
 * Pure commission math — no DB / framework deps.
 * Faithful port of agent_portal/commission_core/calculator.py (owner-locked).
 */

export const TIERS: ReadonlyArray<{
  low: number;
  high: number | null;
  rate: number;
  label: string;
}> = [
  { low: 1, high: 20, rate: 0.01, label: "Tier 1" },
  { low: 21, high: 31, rate: 0.0125, label: "Tier 2" },
  { low: 32, high: 39, rate: 0.015, label: "Tier 3" },
  { low: 40, high: 45, rate: 0.0175, label: "Tier 4 – President's Club" },
  { low: 46, high: 60, rate: 0.02, label: "Tier 5 – Chairman's Club" },
  { low: 61, high: null, rate: 0.0225, label: "Tier 6 – Legacy Club" },
];

export const CANCELLATION_PENALTY_THRESHOLD = 20;
export const QUALITY_BONUS_THRESHOLD = 10;

export const AGENT_FIXED_RATES: Record<string, number> = {
  "alex tambouly": 0.02,
  "peter godwin": 0.0175,
};

export function agentIdentityKey(agentName: string): string {
  return (agentName || "").trim().toLowerCase();
}

export function getFixedRate(agentName: string | null | undefined): number | null {
  const rate = AGENT_FIXED_RATES[agentIdentityKey(agentName || "")];
  return rate === undefined ? null : rate;
}

export function getTier(units: number): { tier: number; rate: number; label: string } {
  if (units < 1) {
    throw new Error(`Units ${units} out of valid range (must be >= 1)`);
  }
  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    if (units >= t.low && (t.high === null || units <= t.high)) {
      return { tier: i + 1, rate: t.rate, label: t.label };
    }
  }
  throw new Error(`Units ${units} out of valid range (must be >= 1)`);
}

/** Collapse casing variants of the same agent within one file. */
export function buildCanonicalAgentNameMap(rawNames: Iterable<string | null | undefined>): Map<string, string> {
  const seenOrder: string[] = [];
  const counts = new Map<string, number>();
  for (const raw of rawNames) {
    const name = (raw || "").trim();
    if (!name) continue;
    if (!counts.has(name)) {
      counts.set(name, 0);
      seenOrder.push(name);
    }
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const canonicalByKey = new Map<string, string>();
  for (const raw of seenOrder) {
    const key = agentIdentityKey(raw);
    const current = canonicalByKey.get(key);
    if (current === undefined) {
      canonicalByKey.set(key, raw);
      continue;
    }
    const challengerRank: [number, boolean] = [counts.get(raw)!, raw !== raw.toLowerCase()];
    const currentRank: [number, boolean] = [counts.get(current)!, current !== current.toLowerCase()];
    if (
      challengerRank[0] > currentRank[0] ||
      (challengerRank[0] === currentRank[0] && challengerRank[1] && !currentRank[1])
    ) {
      canonicalByKey.set(key, raw);
    }
  }
  return canonicalByKey;
}

export function canonicalizeAgentNames<T extends { agentName: string }>(rows: T[]): void {
  const map = buildCanonicalAgentNameMap(rows.map((r) => r.agentName));
  for (const row of rows) {
    const raw = (row.agentName || "").trim();
    if (raw) row.agentName = map.get(agentIdentityKey(raw)) || raw;
  }
}

export type AgentCommissionResult = {
  agentName: string;
  unitsCleared: number;
  totalClearedDebt: number;
  cancellationRate: number;
  hourlyDraw: number;
  rawTier: number;
  adjustedTier: number;
  tierRate: number;
  grossCommission: number;
  payout: number;
  payoutType: "commission" | "draw";
  qualityBonusEligible: boolean;
  cancellationPenaltyApplied: boolean;
  notes: string;
  // filled by CRM parser:
  clawbackAmount?: number;
  netCommission?: number;
  nsfFlagged?: boolean;
  pendingUnits?: number;
  pendingDebt?: number;
  source?: string;
};

export function calculateAgentCommission(opts: {
  agentName: string;
  unitsCleared: number;
  totalClearedDebt: number;
  cancellationRatePct: number;
  hourlyDraw?: number;
}): AgentCommissionResult {
  const { agentName, unitsCleared, totalClearedDebt, cancellationRatePct } = opts;
  const hourlyDraw = opts.hourlyDraw ?? 0;

  const raw = getTier(unitsCleared);
  let penaltyApplied = cancellationRatePct > CANCELLATION_PENALTY_THRESHOLD;
  let adjustedTier = penaltyApplied ? Math.max(1, raw.tier - 1) : raw.tier;
  let tierRate = TIERS[adjustedTier - 1].rate;
  let tierLabel = TIERS[adjustedTier - 1].label;

  const fixedRate = getFixedRate(agentName);
  if (fixedRate !== null) {
    penaltyApplied = false;
    adjustedTier = raw.tier;
    tierRate = fixedRate;
    tierLabel = "Fixed Rate (contract)";
  }

  const grossCommission = tierRate * totalClearedDebt;
  const useCommission = grossCommission > hourlyDraw;
  const payout = useCommission ? grossCommission : hourlyDraw;
  const payoutType = useCommission ? ("commission" as const) : ("draw" as const);
  const qualityBonusEligible = cancellationRatePct < QUALITY_BONUS_THRESHOLD;

  const notesParts: string[] = [];
  if (fixedRate !== null) {
    notesParts.push(`Fixed rate ${(tierRate * 100).toFixed(2)}% (contract override, tier table not applied)`);
  } else {
    notesParts.push(`Tier ${adjustedTier} (${tierLabel}) @ ${(tierRate * 100).toFixed(2)}%`);
    if (penaltyApplied) {
      notesParts.push(
        `Tier dropped from ${raw.tier} due to cancellation rate ${cancellationRatePct.toFixed(1)}% > 20%`,
      );
    }
  }
  if (qualityBonusEligible) {
    notesParts.push("Quality bonus rate eligible (< 10% cancellations) — pending manual review");
  }
  if (payoutType === "draw") {
    notesParts.push("Commission below draw; agent receives hourly draw");
  }

  return {
    agentName,
    unitsCleared,
    totalClearedDebt,
    cancellationRate: cancellationRatePct,
    hourlyDraw,
    rawTier: raw.tier,
    adjustedTier,
    tierRate,
    grossCommission,
    payout,
    payoutType,
    qualityBonusEligible,
    cancellationPenaltyApplied: penaltyApplied,
    notes: notesParts.join(" | "),
  };
}

export function getAdjustedTierRate(
  units: number,
  cancellationRatePct: number,
  agentName?: string | null,
): { tier: number; rate: number } {
  const fixed = getFixedRate(agentName);
  if (fixed !== null) {
    const rawTier = units > 0 ? getTier(units).tier : 0;
    return { tier: rawTier, rate: fixed };
  }
  if (units <= 0) return { tier: 0, rate: 0 };
  const raw = getTier(units);
  const penalty = cancellationRatePct > CANCELLATION_PENALTY_THRESHOLD;
  const adjusted = penalty ? Math.max(1, raw.tier - 1) : raw.tier;
  return { tier: adjusted, rate: TIERS[adjusted - 1].rate };
}

export function calculateClawbackAmount(
  origUnits: number,
  origTotalDebt: number,
  origGrossCommission: number,
  origCancellationRatePct: number,
  clientDebt: number,
  agentName?: string | null,
): number {
  const fixed = getFixedRate(agentName);
  if (fixed !== null) {
    return Math.max(0, Math.round(clientDebt * fixed * 100) / 100);
  }
  if (origUnits <= 1) {
    return Math.round(origGrossCommission * 100) / 100;
  }
  const newUnits = origUnits - 1;
  const newDebt = origTotalDebt - clientDebt;
  const { rate: newRate } = getAdjustedTierRate(newUnits, origCancellationRatePct);
  const { rate: origRate } = getAdjustedTierRate(origUnits, origCancellationRatePct);
  let cb: number;
  if (newRate !== origRate) {
    cb = origGrossCommission - newRate * newDebt;
  } else {
    cb = clientDebt * origRate;
  }
  return Math.max(0, Math.round(cb * 100) / 100);
}

export function paymentDateForPeriod(periodLabel: string): Date {
  const [y, m] = periodLabel.split("-").map(Number);
  return new Date(Date.UTC(y, m, 25));
}

export function isPeriodClosedByPayday(periodLabel: string, asOf: Date = new Date()): boolean {
  return asOf.getTime() >= paymentDateForPeriod(periodLabel).getTime();
}

/**
 * Units still needed this period to reach the next tier's low threshold.
 * null for fixed-rate agents (Alex/Peter) or already at Tier 6.
 */
export function unitsToNextTier(
  unitsCleared: number,
  agentName?: string | null,
): number | null {
  if (getFixedRate(agentName) !== null) return null;
  if (unitsCleared < 1) return TIERS[0].low - unitsCleared;
  const { tier } = getTier(unitsCleared);
  if (tier >= TIERS.length) return null;
  const nextLow = TIERS[tier].low; // next tier (0-indexed: current tier index = tier-1, next = tier)
  return nextLow - unitsCleared;
}

/**
 * Motivational "tier up and earn this much more" on the same cleared debt
 * at the next tier's rate. Not a payout forecast — more units also add debt.
 */
export function commissionGainAtNextTier(
  adjustedTier: number,
  totalClearedDebt: number,
  grossCommission: number,
  agentName?: string | null,
): number | null {
  if (getFixedRate(agentName) !== null) return null;
  if (adjustedTier < 1 || adjustedTier >= TIERS.length) return null;
  const nextRate = TIERS[adjustedTier].rate; // next tier (0-indexed)
  const potentialGross = totalClearedDebt * nextRate;
  return Math.round((potentialGross - grossCommission) * 100) / 100;
}
