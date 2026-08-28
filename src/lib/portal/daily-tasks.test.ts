import { describe, expect, it } from "vitest";
import {
  followUpDueYmd,
  followUpTargets,
  isBusinessDay,
  nextBusinessDayOnOrAfter,
  observedHoliday,
  pacificTodayYmd,
  shiftYmd,
  usFederalHolidays,
  ymdFromParsed,
} from "./daily-tasks-dates";
import { parseDate } from "@/lib/commission/crm-parser";

describe("daily-tasks dates", () => {
  it("shifts YYYY-MM-DD by whole calendar days", () => {
    expect(shiftYmd("2026-08-28", -3)).toBe("2026-08-25");
    expect(shiftYmd("2026-08-28", -10)).toBe("2026-08-18");
    expect(shiftYmd("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("parses CRM enrolled strings to stable YMD", () => {
    const d = parseDate("8/25/2026");
    expect(d).not.toBeNull();
    expect(ymdFromParsed(d!)).toBe("2026-08-25");
  });

  it("followUpTargets uses Pacific today minus 3 and 10", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    expect(pacificTodayYmd(now)).toBe("2026-08-28");
    const t = followUpTargets(now);
    expect(t.day3Ymd).toBe("2026-08-25");
    expect(t.day10Ymd).toBe("2026-08-18");
  });

  it("rolls weekends forward to Monday", () => {
    expect(nextBusinessDayOnOrAfter("2026-08-29")).toBe("2026-08-31"); // Sat → Mon
    expect(nextBusinessDayOnOrAfter("2026-08-30")).toBe("2026-08-31"); // Sun → Mon
    expect(nextBusinessDayOnOrAfter("2026-08-28")).toBe("2026-08-28"); // Fri stays
  });

  it("observes Independence Day 2026 (Sat → Fri Jul 3)", () => {
    expect(observedHoliday("2026-07-04")).toBe("2026-07-03");
    expect(usFederalHolidays(2026).has("2026-07-03")).toBe(true);
    expect(isBusinessDay("2026-07-03")).toBe(false);
  });

  it("rolls day-3 due off a holiday to the next business day", () => {
    // Enrolled 2026-06-30 → +3 = Jul 3 (observed Independence) → Mon Jul 6
    expect(followUpDueYmd("2026-06-30", 3)).toBe("2026-07-06");
    // Enrolled Mon Aug 24 → +3 = Thu Aug 27 (business day)
    expect(followUpDueYmd("2026-08-24", 3)).toBe("2026-08-27");
  });
});
