import { describe, expect, it } from "vitest";
import {
  followUpTargets,
  pacificTodayYmd,
  shiftYmd,
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
    // 2026-08-28 18:00 UTC = still Aug 28 in Pacific (UTC-7 in Aug)
    const now = new Date("2026-08-28T18:00:00.000Z");
    expect(pacificTodayYmd(now)).toBe("2026-08-28");
    const t = followUpTargets(now);
    expect(t.day3Ymd).toBe("2026-08-25");
    expect(t.day10Ymd).toBe("2026-08-18");
  });
});
