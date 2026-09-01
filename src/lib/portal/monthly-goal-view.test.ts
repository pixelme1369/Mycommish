import { describe, expect, it } from "vitest";
import { buildEnrolledGoalView, goalPaceStatus } from "./monthly-goal-view";

const files = [
  { ymd: "2026-09-02", debt: 40_000 },
  { ymd: "2026-09-08", debt: 35_000 },
  { ymd: "2026-08-20", debt: 50_000 },
];

describe("buildEnrolledGoalView", () => {
  it("counts this month’s enrolled files against the dollar goal", () => {
    const view = buildEnrolledGoalView({
      monthLabel: "2026-09",
      todayYmd: "2026-09-08",
      clearRatePct: 70,
      debtGoal: 2_000_000,
      storedUnitsGoal: 0,
      files,
    });
    expect(view.hasGoal).toBe(true);
    expect(view.unitsActual).toBe(2);
    expect(view.debtActual).toBe(75_000);
    expect(view.enrolledToday).toBe(1);
    expect(view.debtHit).toBe(false);
    expect(view.unitsGoal).toBeGreaterThan(0);
  });

  it("marks a hit when enrolled dollars pass the goal", () => {
    const view = buildEnrolledGoalView({
      monthLabel: "2026-09",
      todayYmd: "2026-09-08",
      clearRatePct: 70,
      debtGoal: 70_000,
      storedUnitsGoal: 0,
      files,
    });
    expect(view.debtHit).toBe(true);
    expect(goalPaceStatus(view)).toBe("hit");
  });
});

describe("goalPaceStatus", () => {
  it("flags no goal, then behind vs on track from working-day pace", () => {
    const none = buildEnrolledGoalView({
      monthLabel: "2026-09",
      todayYmd: "2026-09-08",
      clearRatePct: 70,
      debtGoal: 0,
      storedUnitsGoal: 0,
      files: [],
    });
    expect(goalPaceStatus(none)).toBe("no_goal");

    const behind = buildEnrolledGoalView({
      monthLabel: "2026-09",
      todayYmd: "2026-09-22",
      clearRatePct: 70,
      debtGoal: 2_000_000,
      storedUnitsGoal: 50,
      files: [{ ymd: "2026-09-02", debt: 40_000 }],
    });
    expect(goalPaceStatus(behind)).toBe("behind");
  });
});
