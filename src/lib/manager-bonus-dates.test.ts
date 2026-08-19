import { describe, expect, it } from "vitest";
import { periodLabelForNextPayDate } from "./manager-bonus-dates";

describe("periodLabelForNextPayDate", () => {
  it("before the 25th uses prior calendar month (next payday this month)", () => {
    expect(periodLabelForNextPayDate(new Date(2026, 7, 19))).toBe("2026-07"); // Aug 19 → July
    expect(periodLabelForNextPayDate(new Date(2026, 7, 24))).toBe("2026-07");
  });

  it("on/after the 25th rolls to the current calendar month", () => {
    expect(periodLabelForNextPayDate(new Date(2026, 7, 25))).toBe("2026-08"); // Aug 25 → Aug
    expect(periodLabelForNextPayDate(new Date(2026, 7, 31))).toBe("2026-08");
    expect(periodLabelForNextPayDate(new Date(2026, 8, 1))).toBe("2026-08"); // Sep 1 → Aug
  });

  it("handles January before the 25th", () => {
    expect(periodLabelForNextPayDate(new Date(2026, 0, 10))).toBe("2025-12");
  });
});
