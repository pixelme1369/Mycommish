import { describe, expect, it } from "vitest";
import {
  averageDeal,
  dailyUnitsPace,
  parseDebtInput,
  remainingAgainstGoal,
  sumStage,
  unitsNeededFromDebtGoal,
} from "./monthly-goal-math";
import {
  monthTitle,
  workingDaysElapsed,
  workingDaysRemaining,
  workingYmdsInMonth,
} from "./daily-tasks-dates";

describe("monthly goal remaining", () => {
  it("counts submitted and enrolled independently by date prefix", () => {
    const rows = [
      { ymd: "2026-08-05", premium: 10000 },
      { ymd: "2026-08-20", premium: 5000 },
      { ymd: "2026-07-28", premium: 99999 },
      { ymd: null, premium: 1 },
    ];
    expect(sumStage(rows, "2026-08")).toEqual({ units: 2, debt: 15000 });
    expect(sumStage(rows, "2026-07")).toEqual({ units: 1, debt: 99999 });
  });

  it("clamps remaining at 0 and flags a hit past the goal", () => {
    const over = remainingAgainstGoal(40, 2_000_000, { units: 43, debt: 2_100_000 });
    expect(over.unitsRemaining).toBe(0);
    expect(over.debtRemaining).toBe(0);
    expect(over.unitsActual).toBe(43);
    expect(over.debtActual).toBe(2_100_000);
    expect(over.unitsHit).toBe(true);
    expect(over.debtHit).toBe(true);

    const under = remainingAgainstGoal(40, 2_000_000, { units: 12, debt: 480_000 });
    expect(under.unitsRemaining).toBe(28);
    expect(under.debtRemaining).toBe(1_520_000);
    expect(under.unitsHit).toBe(false);
  });
});

describe("enrolled pace from dollar goal", () => {
  it("turns $2M and $37k average into 54 files and 3/day over 20 working days", () => {
    const avg = averageDeal(1, 37_000);
    expect(avg).toBe(37_000);
    const units = unitsNeededFromDebtGoal(2_000_000, avg);
    expect(units).toBe(54);
    expect(dailyUnitsPace(units, 20)).toBe(3);
  });

  it("uses remaining units over remaining working days", () => {
    expect(dailyUnitsPace(42, 12)).toBe(4);
    expect(dailyUnitsPace(0, 12)).toBe(0);
    expect(dailyUnitsPace(5, 0)).toBe(5);
  });

  it("parses 2m / $2,000,000 debt input", () => {
    expect(parseDebtInput("2m")).toBe(2_000_000);
    expect(parseDebtInput("$2,000,000")).toBe(2_000_000);
    expect(parseDebtInput("37k")).toBe(37_000);
    expect(parseDebtInput("")).toBeNull();
  });
});

describe("September 2026 working days", () => {
  it("excludes weekends and Labor Day (Sep 7)", () => {
    const days = workingYmdsInMonth("2026-09");
    expect(days).not.toContain("2026-09-07");
    expect(days).not.toContain("2026-09-05");
    expect(days).not.toContain("2026-09-06");
    expect(days[0]).toBe("2026-09-01");
    expect(days).toHaveLength(21);
    expect(monthTitle("2026-09")).toBe("September 2026");
  });

  it("counts remaining including today when today is a working day", () => {
    expect(workingDaysRemaining("2026-09", "2026-09-01")).toHaveLength(21);
    expect(workingDaysElapsed("2026-09", "2026-09-01")).toHaveLength(0);
    expect(workingDaysRemaining("2026-09", "2026-09-08")).toHaveLength(17);
  });
});
