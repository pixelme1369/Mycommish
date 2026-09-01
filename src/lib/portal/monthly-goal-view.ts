import {
  averageDeal,
  dailyUnitsPace,
  remainingAgainstGoal,
  unitsNeededFromDebtGoal,
} from "@/lib/portal/monthly-goal-math";
import {
  monthTitle,
  shiftYmd,
  workingDaysElapsed,
  workingDaysRemaining,
  workingYmdsInMonth,
} from "@/lib/portal/daily-tasks-dates";

export type EnrolledGoalView = {
  monthLabel: string;
  monthTitle: string;
  todayYmd: string;
  hasGoal: boolean;
  debtGoal: number;
  unitsGoal: number;
  clearRatePct: number;
  unitsGoalSource: "entered" | "derived" | "none";
  enteredDailyUnits: number | null;
  unitsActual: number;
  debtActual: number;
  unitsRemaining: number;
  debtRemaining: number;
  unitsPct: number;
  debtPct: number;
  unitsHit: boolean;
  debtHit: boolean;
  avgDeal: number;
  avgDealSource: "month" | "history" | "none";
  workingDaysTotal: number;
  workingDaysLeft: number;
  workingDaysElapsed: number;
  dailyPace: number;
  enrolledToday: number;
  debtToday: number;
};

export type GoalPaceStatus = "no_goal" | "hit" | "on_track" | "behind";

export type AgentGoalRosterRow = {
  agentId: string;
  displayName: string;
  email: string;
  role: string;
  paceStatus: GoalPaceStatus;
  view: EnrolledGoalView;
};

function pct(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((actual / goal) * 100));
}

export function goalPaceStatus(view: EnrolledGoalView): GoalPaceStatus {
  if (!view.hasGoal) return "no_goal";
  const hit = view.debtGoal > 0 ? view.debtHit : view.unitsHit;
  if (hit) return "hit";
  const expectedPct =
    view.workingDaysTotal > 0
      ? Math.round((view.workingDaysElapsed / view.workingDaysTotal) * 100)
      : 0;
  const actualPct = view.debtGoal > 0 ? view.debtPct : view.unitsPct;
  return actualPct + 5 >= expectedPct ? "on_track" : "behind";
}

export function buildEnrolledGoalView(opts: {
  monthLabel: string;
  todayYmd: string;
  clearRatePct: number;
  debtGoal: number;
  storedUnitsGoal: number;
  files: Array<{ ymd: string; debt: number }>;
}): EnrolledGoalView {
  const { monthLabel, todayYmd, clearRatePct } = opts;
  const historyFrom = shiftYmd(todayYmd, -90);
  const monthRows = opts.files.filter((r) => r.ymd.startsWith(monthLabel));
  const unitsActual = monthRows.length;
  const debtActual = monthRows.reduce((s, r) => s + r.debt, 0);
  const todayRows = monthRows.filter((r) => r.ymd === todayYmd);

  let avgDeal = averageDeal(unitsActual, debtActual);
  let avgDealSource: EnrolledGoalView["avgDealSource"] = unitsActual > 0 ? "month" : "none";
  if (avgDeal <= 0) {
    const hist = opts.files.filter((r) => r.ymd >= historyFrom && r.ymd <= todayYmd);
    avgDeal = averageDeal(hist.length, hist.reduce((s, r) => s + r.debt, 0));
    if (avgDeal > 0) avgDealSource = "history";
  }

  const debtGoal = opts.debtGoal;
  const storedUnitsGoal = opts.storedUnitsGoal;
  const working = workingYmdsInMonth(monthLabel);
  const daysLeft = workingDaysRemaining(monthLabel, todayYmd).length;
  const daysElapsed = workingDaysElapsed(monthLabel, todayYmd).length;
  const workingDaysTotal = working.length;

  const enteredDailyUnits =
    storedUnitsGoal > 0 && workingDaysTotal > 0
      ? Math.round(storedUnitsGoal / workingDaysTotal)
      : null;

  let unitsGoal = storedUnitsGoal;
  let unitsGoalSource: EnrolledGoalView["unitsGoalSource"] = "none";
  if (storedUnitsGoal > 0) {
    unitsGoalSource = "entered";
  } else if (debtGoal > 0 && avgDeal > 0) {
    unitsGoal = unitsNeededFromDebtGoal(debtGoal, avgDeal);
    unitsGoalSource = "derived";
  }

  const progress = remainingAgainstGoal(unitsGoal, debtGoal, {
    units: unitsActual,
    debt: debtActual,
  });
  const dailyPace = dailyUnitsPace(progress.unitsRemaining, daysLeft);
  const hasGoal = debtGoal > 0 || storedUnitsGoal > 0;

  return {
    monthLabel,
    monthTitle: monthTitle(monthLabel),
    todayYmd,
    hasGoal,
    debtGoal,
    unitsGoal,
    clearRatePct,
    unitsGoalSource,
    enteredDailyUnits: enteredDailyUnits && enteredDailyUnits > 0 ? enteredDailyUnits : null,
    unitsActual,
    debtActual,
    unitsRemaining: progress.unitsRemaining,
    debtRemaining: progress.debtRemaining,
    unitsPct: pct(unitsActual, unitsGoal),
    debtPct: pct(debtActual, debtGoal),
    unitsHit: progress.unitsHit,
    debtHit: progress.debtHit,
    avgDeal,
    avgDealSource,
    workingDaysTotal,
    workingDaysLeft: daysLeft,
    workingDaysElapsed: daysElapsed,
    dailyPace,
    enrolledToday: todayRows.length,
    debtToday: todayRows.reduce((s, r) => s + r.debt, 0),
  };
}
