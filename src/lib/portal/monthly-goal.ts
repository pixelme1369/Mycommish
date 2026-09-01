import { prisma } from "@/lib/db";
import { loadGoalClearRatePct } from "@/lib/portal/goal-settings";
import {
  averageDeal,
  dailyUnitsPace,
  remainingAgainstGoal,
  unitsNeededFromDebtGoal,
} from "@/lib/portal/monthly-goal-math";
import {
  monthTitle,
  pacificTodayYmd,
  pacificYmdFromInstant,
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

function pacificMonthLabelNow(now: Date): string {
  return pacificTodayYmd(now).slice(0, 7);
}

function num(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function pct(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((actual / goal) * 100));
}

export async function loadEnrolledGoal(opts: {
  agentId: string;
  aliasNames: string[];
  now?: Date;
}): Promise<EnrolledGoalView> {
  const now = opts.now ?? new Date();
  const todayYmd = pacificTodayYmd(now);
  const monthLabel = pacificMonthLabelNow(now);
  const names = opts.aliasNames.map((n) => n.trim()).filter(Boolean);
  const historyFrom = shiftYmd(todayYmd, -90);

  const [goalRow, files, clearRatePct] = await Promise.all([
    prisma.agentMonthlyGoal.findUnique({
      where: {
        agentId_monthLabel: { agentId: opts.agentId, monthLabel },
      },
    }),
    prisma.forthContact.findMany({
      where: {
        droppedDate: null,
        enrolledDate: { not: null },
        OR: [
          { agentId: opts.agentId },
          ...(names.length
            ? names.map((n) => ({
                assignedTo: { equals: n, mode: "insensitive" as const },
              }))
            : []),
        ],
      },
      select: {
        forthId: true,
        enrolledDate: true,
        enrolledAmount: true,
      },
    }),
    loadGoalClearRatePct(),
  ]);

  const seen = new Set<string>();
  const rows: Array<{ ymd: string; debt: number }> = [];
  for (const f of files) {
    if (seen.has(f.forthId) || !f.enrolledDate) continue;
    seen.add(f.forthId);
    rows.push({
      ymd: pacificYmdFromInstant(f.enrolledDate),
      debt: num(f.enrolledAmount),
    });
  }

  const monthRows = rows.filter((r) => r.ymd.startsWith(monthLabel));
  const unitsActual = monthRows.length;
  const debtActual = monthRows.reduce((s, r) => s + r.debt, 0);
  const todayRows = monthRows.filter((r) => r.ymd === todayYmd);

  let avgDeal = averageDeal(unitsActual, debtActual);
  let avgDealSource: EnrolledGoalView["avgDealSource"] = unitsActual > 0 ? "month" : "none";
  if (avgDeal <= 0) {
    const hist = rows.filter((r) => r.ymd >= historyFrom && r.ymd <= todayYmd);
    avgDeal = averageDeal(hist.length, hist.reduce((s, r) => s + r.debt, 0));
    if (avgDeal > 0) avgDealSource = "history";
  }

  const debtGoal = num(goalRow?.debtGoal);
  const storedUnitsGoal = goalRow?.unitsGoal ?? 0;
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

export async function saveEnrolledGoal(opts: {
  agentId: string;
  monthLabel: string;
  debtGoal: number;
  unitsGoal: number;
}): Promise<void> {
  await prisma.agentMonthlyGoal.upsert({
    where: {
      agentId_monthLabel: { agentId: opts.agentId, monthLabel: opts.monthLabel },
    },
    create: {
      agentId: opts.agentId,
      monthLabel: opts.monthLabel,
      unitsGoal: opts.unitsGoal,
      debtGoal: opts.debtGoal,
    },
    update: {
      unitsGoal: opts.unitsGoal,
      debtGoal: opts.debtGoal,
    },
  });
}
