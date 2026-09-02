import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import { loadGoalClearRatePct } from "@/lib/portal/goal-settings";
import {
  monthTitle,
  pacificTodayYmd,
  pacificYmdFromInstant,
  shiftYmd,
} from "@/lib/portal/daily-tasks-dates";
import {
  buildEnrolledGoalView,
  goalPaceStatus,
  type AgentGoalRosterRow,
  type EnrolledGoalView,
  type GoalPaceStatus,
} from "@/lib/portal/monthly-goal-view";

export type { AgentGoalRosterRow, EnrolledGoalView, GoalPaceStatus };
export { buildEnrolledGoalView, goalPaceStatus };

function pacificMonthLabelNow(now: Date): string {
  return pacificTodayYmd(now).slice(0, 7);
}

function num(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

const GOAL_ROSTER_ROLES: AgentRole[] = [
  AgentRole.agent,
  AgentRole.manager,
];

export async function loadEnrolledGoal(opts: {
  agentId: string;
  aliasNames: string[];
  now?: Date;
}): Promise<EnrolledGoalView> {
  const now = opts.now ?? new Date();
  const todayYmd = pacificTodayYmd(now);
  const monthLabel = pacificMonthLabelNow(now);
  const names = opts.aliasNames.map((n) => n.trim()).filter(Boolean);

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

  return buildEnrolledGoalView({
    monthLabel,
    todayYmd,
    clearRatePct,
    debtGoal: num(goalRow?.debtGoal),
    storedUnitsGoal: goalRow?.unitsGoal ?? 0,
    files: rows,
  });
}

export async function listEnrolledGoalsForAdmin(opts?: {
  now?: Date;
}): Promise<{
  monthTitle: string;
  monthLabel: string;
  todayYmd: string;
  rows: AgentGoalRosterRow[];
}> {
  const now = opts?.now ?? new Date();
  const todayYmd = pacificTodayYmd(now);
  const monthLabel = pacificMonthLabelNow(now);
  const historyFrom = shiftYmd(todayYmd, -90);
  const enrolledGte = new Date(`${shiftYmd(historyFrom, -2)}T00:00:00.000Z`);

  const [agents, goalRows, files, clearRatePct] = await Promise.all([
    prisma.agent.findMany({
      where: {
        role: { in: GOAL_ROSTER_ROLES },
        suspendedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        aliases: { select: { agentName: true } },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.agentMonthlyGoal.findMany({
      where: { monthLabel },
      select: { agentId: true, debtGoal: true, unitsGoal: true },
    }),
    prisma.forthContact.findMany({
      where: {
        droppedDate: null,
        enrolledDate: { gte: enrolledGte },
      },
      select: {
        forthId: true,
        agentId: true,
        assignedTo: true,
        enrolledDate: true,
        enrolledAmount: true,
      },
    }),
    loadGoalClearRatePct(),
  ]);

  const goalByAgent = new Map(goalRows.map((g) => [g.agentId, g]));
  const aliasToAgentIds = new Map<string, string[]>();
  for (const a of agents) {
    for (const al of a.aliases) {
      const key = al.agentName.trim().toLowerCase();
      if (!key) continue;
      const list = aliasToAgentIds.get(key) ?? [];
      list.push(a.id);
      aliasToAgentIds.set(key, list);
    }
  }

  const filesByAgent = new Map<string, Array<{ ymd: string; debt: number }>>();
  const seenByAgent = new Map<string, Set<string>>();
  function pushFile(agentId: string, forthId: string, ymd: string, debt: number) {
    let seen = seenByAgent.get(agentId);
    if (!seen) {
      seen = new Set();
      seenByAgent.set(agentId, seen);
    }
    if (seen.has(forthId)) return;
    seen.add(forthId);
    const list = filesByAgent.get(agentId) ?? [];
    list.push({ ymd, debt });
    filesByAgent.set(agentId, list);
  }

  const agentIds = new Set(agents.map((a) => a.id));
  for (const f of files) {
    if (!f.enrolledDate) continue;
    const ymd = pacificYmdFromInstant(f.enrolledDate);
    const debt = num(f.enrolledAmount);
    const claimed = new Set<string>();
    if (f.agentId && agentIds.has(f.agentId)) claimed.add(f.agentId);
    const assigned = (f.assignedTo || "").trim().toLowerCase();
    if (assigned) {
      for (const id of aliasToAgentIds.get(assigned) ?? []) claimed.add(id);
    }
    for (const id of claimed) pushFile(id, f.forthId, ymd, debt);
  }

  const rows: AgentGoalRosterRow[] = agents.map((a) => {
    const goal = goalByAgent.get(a.id);
    const view = buildEnrolledGoalView({
      monthLabel,
      todayYmd,
      clearRatePct,
      debtGoal: num(goal?.debtGoal),
      storedUnitsGoal: goal?.unitsGoal ?? 0,
      files: filesByAgent.get(a.id) ?? [],
    });
    return {
      agentId: a.id,
      displayName: a.displayName,
      email: a.email,
      role: a.role,
      paceStatus: goalPaceStatus(view),
      view,
    };
  });

  const rank: Record<GoalPaceStatus, number> = {
    behind: 0,
    on_track: 1,
    hit: 2,
    no_goal: 3,
  };
  rows.sort((a, b) => {
    const d = rank[a.paceStatus] - rank[b.paceStatus];
    if (d !== 0) return d;
    const aPct = a.view.debtGoal > 0 ? a.view.debtPct : a.view.unitsPct;
    const bPct = b.view.debtGoal > 0 ? b.view.debtPct : b.view.unitsPct;
    if (aPct !== bPct) return aPct - bPct;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    monthTitle: monthTitle(monthLabel),
    monthLabel,
    todayYmd,
    rows,
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
