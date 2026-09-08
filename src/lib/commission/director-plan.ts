/**
 * Alex Tambouly Director plan (from 2026-09).
 * Does not change standard TIERS / other agents.
 *
 * Personal CRM files are house deals: $0 commission, $0 clawback.
 * Pay is a marginal per-file override on the period’s “Units cleared”
 * total (same basis as admin: exclude currently dismissed / openers /
 * period-excluded agents).
 */

/** Same 25% rule as the agent ladder — kept here to avoid a calculator import cycle. */
const PERSONAL_CANCEL_PENALTY_THRESHOLD = 25;

export const ALEX_DIRECTOR_IDENTITY_KEY = "alex tambouly";
export const ALEX_DIRECTOR_PLAN_FROM = "2026-09";
/** Personal production expectation — house deals, not commissioned. */
export const ALEX_PERSONAL_PRODUCTION_TARGET = 1_250_000;
export const ALEX_DIRECTOR_CANONICAL_NAME = "Alex Tambouly";

function identityKey(agentName: string): string {
  return (agentName || "").trim().toLowerCase();
}

export type DirectorOverrideBand = {
  low: number;
  high: number | null;
  rate: number;
  reducedRate: number;
  label: string;
};

/** Marginal bands — not achieved-tier. 1,600 files = 1,000×$28 + 500×$20 + 100×$15. */
export const ALEX_DIRECTOR_OVERRIDE_BANDS: ReadonlyArray<DirectorOverrideBand> = [
  { low: 1, high: 1000, rate: 28, reducedRate: 23, label: "Band 1" },
  { low: 1001, high: 1500, rate: 20, reducedRate: 15, label: "Band 2" },
  { low: 1501, high: 2000, rate: 15, reducedRate: 10, label: "Band 3" },
  { low: 2001, high: null, rate: 10, reducedRate: 5, label: "Band 4" },
];

export function isAlexDirectorIdentity(agentName?: string | null): boolean {
  return identityKey(agentName || "") === ALEX_DIRECTOR_IDENTITY_KEY;
}

/** True when this CRM name is on the Director plan for that YYYY-MM period. */
export function isAlexDirectorPlan(
  agentName?: string | null,
  periodLabel?: string | null,
): boolean {
  if (!isAlexDirectorIdentity(agentName)) return false;
  const label = (periodLabel || "").trim();
  if (!/^\d{4}-\d{2}$/.test(label)) return false;
  return label >= ALEX_DIRECTOR_PLAN_FROM;
}

export type PersonalProductionProgress = {
  target: number;
  cleared: number;
  remaining: number;
  pct: number;
  met: boolean;
};

/** Progress toward the $1.25M personal cleared-debt expectation (house deals). */
export function personalProductionProgress(
  personalClearedDebt: number,
  target: number = ALEX_PERSONAL_PRODUCTION_TARGET,
): PersonalProductionProgress {
  const cleared = Math.max(0, Number(personalClearedDebt) || 0);
  const t = target > 0 ? target : ALEX_PERSONAL_PRODUCTION_TARGET;
  const remaining = Math.max(0, Math.round((t - cleared) * 100) / 100);
  const met = cleared >= t;
  const pct = t > 0 ? Math.min(100, Math.round((cleared / t) * 1000) / 10) : 0;
  return { target: t, cleared, remaining, pct, met };
}

export type DirectorOverrideSlice = {
  label: string;
  files: number;
  rate: number;
  amount: number;
};

export type DirectorOverrideResult = {
  companyFiles: number;
  personalCancelRatePct: number;
  penaltyApplied: boolean;
  slices: DirectorOverrideSlice[];
  amount: number;
  note: string;
};

export function directorPenaltyApplies(personalCancelRatePct: number): boolean {
  return personalCancelRatePct > PERSONAL_CANCEL_PENALTY_THRESHOLD;
}

/**
 * Marginal override on company surviving cleared files.
 * Personal cancel rate > 25% drops every band by $5 for that month.
 * Exactly 25% does not.
 */
export function calculateDirectorOverride(opts: {
  companySurvivingFiles: number;
  personalCancelRatePct: number;
}): DirectorOverrideResult {
  const companyFiles = Math.max(0, Math.floor(opts.companySurvivingFiles));
  const personalCancelRatePct = Number.isFinite(opts.personalCancelRatePct)
    ? opts.personalCancelRatePct
    : 0;
  const penaltyApplied = directorPenaltyApplies(personalCancelRatePct);
  const slices: DirectorOverrideSlice[] = [];
  let remaining = companyFiles;

  for (const band of ALEX_DIRECTOR_OVERRIDE_BANDS) {
    if (remaining <= 0) break;
    const span = band.high == null ? remaining : band.high - band.low + 1;
    const files = Math.min(remaining, Math.max(0, span));
    if (files <= 0) continue;
    const rate = penaltyApplied ? band.reducedRate : band.rate;
    const amount = Math.round(files * rate * 100) / 100;
    slices.push({ label: band.label, files, rate, amount });
    remaining -= files;
  }

  const amount = Math.round(slices.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const sliceBit = slices.length
    ? slices.map((x) => `${x.label} ${x.files}×$${formatDollars(x.rate)}`).join(" + ")
    : "0 files";
  const penaltyBit = penaltyApplied
    ? ` (personal cancel ${personalCancelRatePct.toFixed(1)}% > ${PERSONAL_CANCEL_PENALTY_THRESHOLD}%)`
    : "";
  const note = `Director override${penaltyBit}: ${companyFiles} file${
    companyFiles === 1 ? "" : "s"
  } · ${sliceBit} = $${formatDollars(amount)}`;

  return {
    companyFiles,
    personalCancelRatePct,
    penaltyApplied,
    slices,
    amount,
    note,
  };
}

function formatDollars(n: number): string {
  return n.toFixed(2).replace(/\.00$/, "");
}

export function parseDirectorOverrideNote(note: string | null | undefined): {
  companyFiles: number;
  penaltyApplied: boolean;
  amount: number;
} | null {
  if (!note) return null;
  const m = note.match(
    /^Director override( \(personal cancel [^)]+\))?: (\d+) files? · .+ = \$([\d.]+)\s*$/i,
  );
  if (!m) return null;
  return {
    companyFiles: Number(m[2]),
    penaltyApplied: Boolean(m[1]),
    amount: Number(m[3]),
  };
}

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Dismissed / suspended on or before the clear calendar day is not active
 * at the time the file cleared. No clear date + a later inactive stamp → exclude.
 */
export function agentInactiveAtClear(opts: {
  clearAt: Date | null;
  dismissedAt?: Date | null;
  suspendedAt?: Date | null;
}): boolean {
  const inactiveOn = (stamp: Date | null | undefined) => {
    if (!stamp) return false;
    if (!opts.clearAt) return true;
    return utcDay(stamp) <= utcDay(opts.clearAt);
  };
  return inactiveOn(opts.dismissedAt) || inactiveOn(opts.suspendedAt);
}
