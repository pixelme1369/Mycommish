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

export function parseUnitsPerDay(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}
