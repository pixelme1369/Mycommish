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

export type MonthlyGoalProgress = {
  monthLabel: string;
  unitsGoal: number;
  debtGoal: number;
  submitted: StageProgress;
  enrolled: StageProgress;
  lastSyncedAt: string | null;
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
