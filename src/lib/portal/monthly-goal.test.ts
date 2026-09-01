import { describe, expect, it } from "vitest";
import { remainingAgainstGoal, sumStage } from "./monthly-goal-math";

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
