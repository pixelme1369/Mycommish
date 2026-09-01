export type StageActual = {
  units: number;
  debt: number;
};

export type StageProgress = {
  unitsGoal: number;
  debtGoal: number;
  unitsActual: number;
  debtActual: number;
  unitsRemaining: number;
  debtRemaining: number;
  unitsHit: boolean;
  debtHit: boolean;
};

export function remainingAgainstGoal(
  unitsGoal: number,
  debtGoal: number,
  actual: StageActual,
): StageProgress {
  const unitsRemaining = Math.max(0, unitsGoal - actual.units);
  const debtRemaining = Math.max(0, debtGoal - actual.debt);
  return {
    unitsGoal,
    debtGoal,
    unitsActual: actual.units,
    debtActual: actual.debt,
    unitsRemaining,
    debtRemaining,
    unitsHit: actual.units >= unitsGoal && unitsGoal > 0,
    debtHit: actual.debt >= debtGoal && debtGoal > 0,
  };
}

export function sumStage(
  rows: Array<{ ymd: string | null; premium: number }>,
  monthLabel: string,
): StageActual {
  let units = 0;
  let debt = 0;
  for (const row of rows) {
    if (!row.ymd || !row.ymd.startsWith(monthLabel)) continue;
    units += 1;
    debt += row.premium;
  }
  return { units, debt };
}

export function averageDeal(units: number, debt: number): number {
  if (units <= 0 || debt <= 0) return 0;
  return debt / units;
}

/** $2M / $37k ≈ 54 files (round). Daily pace still ceils 54/20 → 3. */
export function unitsNeededFromDebtGoal(debtGoal: number, avgDeal: number): number {
  if (debtGoal <= 0 || avgDeal <= 0) return 0;
  return Math.max(1, Math.round(debtGoal / avgDeal));
}

/** 54 / 20 = 2.7 → 3 files per working day. */
export function dailyUnitsPace(unitsRemaining: number, workingDaysLeft: number): number {
  if (unitsRemaining <= 0) return 0;
  if (workingDaysLeft <= 0) return unitsRemaining;
  return Math.ceil(unitsRemaining / workingDaysLeft);
}

export function parseDebtInput(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!t) return null;
  let mult = 1;
  let num = t;
  if (t.endsWith("m")) {
    mult = 1_000_000;
    num = t.slice(0, -1);
  } else if (t.endsWith("k")) {
    mult = 1_000;
    num = t.slice(0, -1);
  }
  if (!num) return null;
  const n = Number(num);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * mult;
}

export const DEBT_GOAL_PRESETS = [
  { value: 1_000_000, label: "$1M" },
  { value: 1_500_000, label: "$1.5M" },
  { value: 2_000_000, label: "$2M" },
  { value: 2_500_000, label: "$2.5M" },
  { value: 3_000_000, label: "$3M" },
] as const;

/** $1,000,000 — commas in the typed field. */
export function formatDebtInputDisplay(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Insert thousands commas while typing. Leaves 1.5m / 2m shorthands alone
 * until they resolve to a whole number.
 */
export function formatDebtTyping(raw: string): string {
  if (!raw.trim()) return "";
  const stripped = raw.replace(/[$,\s]/g, "");
  if (!stripped) return raw.includes("$") ? "$" : "";
  if (/[a-z]/i.test(stripped) || stripped.endsWith(".")) return raw;
  const parsed = parseDebtInput(raw);
  if (parsed == null) return raw;
  return formatDebtInputDisplay(parsed);
}

export function parseUnitsPerDay(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}

/** Default share of enrolled files expected to clear into a paycheck. */
export const DEFAULT_CLEAR_RATE_PCT = 70;

/** 1–100 percent. Empty → null (caller applies default). */
export function parseClearRatePct(raw: string): number | null {
  const t = raw.trim().replace(/%/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function dropRateFromClearPct(clearPct: number): number {
  const p = Number.isFinite(clearPct) ? clearPct : DEFAULT_CLEAR_RATE_PCT;
  return Math.min(0.99, Math.max(0, 1 - p / 100));
}

/** Units / $ expected to clear into commission at this clear rate. */
export function applyClearRate(
  units: number,
  debt: number,
  clearPct: number = DEFAULT_CLEAR_RATE_PCT,
): { units: number; debt: number } {
  const rate = 1 - dropRateFromClearPct(clearPct);
  return {
    units: Math.round(Math.max(0, units) * rate),
    debt: Math.round(Math.max(0, debt) * rate * 100) / 100,
  };
}

/** Keep-goal / clear-rate. $1M at 70% clear → originate ~$1.43M. */
export function enrollToKeepAfterDrops(
  keepGoal: number,
  dropRate: number = dropRateFromClearPct(DEFAULT_CLEAR_RATE_PCT),
): number {
  if (keepGoal <= 0) return 0;
  const kept = 1 - dropRate;
  if (kept <= 0 || kept > 1) return keepGoal;
  return Math.round(keepGoal / kept);
}
