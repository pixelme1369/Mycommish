import { describe, expect, it } from "vitest";
import {
  formatPaidOnDisplay,
  isWeekendPaidOn,
  parsePaidOnDate,
  periodLabelForNextPayDate,
} from "./manager-bonus-dates";

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

describe("formatPaidOnDisplay", () => {
  it("appends wk for Saturday/Sunday (legacy plain formatter)", () => {
    const sat = parsePaidOnDate("2026-08-08")!; // Saturday
    const mon = parsePaidOnDate("2026-08-17")!; // Monday
    expect(formatPaidOnDisplay(sat)).toBe("Aug 8, 2026 wk");
    expect(formatPaidOnDisplay(mon)).toBe("Aug 17, 2026");
    expect(isWeekendPaidOn(sat)).toBe(true);
    expect(isWeekendPaidOn(mon)).toBe(false);
  });
});
