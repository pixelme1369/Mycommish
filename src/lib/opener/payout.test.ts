import { describe, expect, it } from "vitest";
import {
  OPENER_PAY_APPROVED,
  OPENER_PAY_EXCLUDED,
  openerPayoutForDebt,
  openerPayStatusFromForthStatus,
  openerPeriodFromYmd,
  openerSnapshotFromForth,
  formatOpenerPayDate,
  openerMonthYmdRange,
  openerMonthDays,
  formatOpenerTransferDay,
  ymdInOpenerMonth,
  clampYmdToOpenerMonth,
} from "./payout";

describe("openerPayoutForDebt", () => {
  it("blocks under $5,000", () => {
    expect(openerPayoutForDebt(0)).toBeNull();
    expect(openerPayoutForDebt(4_999.99)).toBeNull();
  });

  it("pays $15 through $24,999", () => {
    expect(openerPayoutForDebt(5_000)).toBe(15);
    expect(openerPayoutForDebt(9_999)).toBe(15);
    expect(openerPayoutForDebt(24_999)).toBe(15);
  });

  it("pays $30 from $25,000 through $44,999", () => {
    expect(openerPayoutForDebt(25_000)).toBe(30);
    expect(openerPayoutForDebt(44_999)).toBe(30);
  });

  it("pays $50 from $45,000 up", () => {
    expect(openerPayoutForDebt(45_000)).toBe(50);
    expect(openerPayoutForDebt(50_000)).toBe(50);
    expect(openerPayoutForDebt(120_000)).toBe(50);
  });
});

describe("openerPayStatusFromForthStatus", () => {
  it("approves Active and Waiting For First Payment", () => {
    expect(openerPayStatusFromForthStatus("Active")).toBe(OPENER_PAY_APPROVED);
    expect(openerPayStatusFromForthStatus("waiting for first payment")).toBe(
      OPENER_PAY_APPROVED,
    );
  });

  it("excludes everything else", () => {
    expect(openerPayStatusFromForthStatus("Cancelled")).toBe(OPENER_PAY_EXCLUDED);
    expect(openerPayStatusFromForthStatus(null)).toBe(OPENER_PAY_EXCLUDED);
  });
});

describe("openerSnapshotFromForth", () => {
  it("marks unmatched when Forth has no contact", () => {
    const snap = openerSnapshotFromForth(null);
    expect(snap.unmatched).toBe(true);
    expect(snap.commission).toBe(0);
    expect(snap.payStatus).toBe(OPENER_PAY_EXCLUDED);
  });

  it("copies CRM fields and computes commission", () => {
    const snap = openerSnapshotFromForth({
      enrolledAmount: 32_000,
      stageTitle: "Docs In",
      status: "Waiting For First Payment",
    });
    expect(snap.unmatched).toBe(false);
    expect(snap.debtLoad).toBe(32_000);
    expect(snap.commission).toBe(30);
    expect(snap.payStatus).toBe(OPENER_PAY_APPROVED);
  });
});

describe("opener pay date", () => {
  it("pays August files on September 25", () => {
    expect(openerPeriodFromYmd("2026-08-14")).toBe("2026-08");
    expect(formatOpenerPayDate("2026-08")).toBe("Sep 25, 2026");
  });
});

describe("openerMonthYmdRange", () => {
  it("bounds August to the 1st through the 31st", () => {
    expect(openerMonthYmdRange("2026-08")).toEqual({
      min: "2026-08-01",
      max: "2026-08-31",
    });
    expect(ymdInOpenerMonth("2026-08-14", "2026-08")).toBe(true);
    expect(ymdInOpenerMonth("2026-09-01", "2026-08")).toBe(false);
    expect(clampYmdToOpenerMonth("2026-09-02", "2026-08")).toBe("2026-08-31");
    expect(clampYmdToOpenerMonth("2026-07-20", "2026-08")).toBe("2026-08-01");
    expect(openerMonthDays("2026-08")).toHaveLength(31);
    expect(openerMonthDays("2026-08")[0]).toBe("2026-08-01");
    expect(openerMonthDays("2026-08").at(-1)).toBe("2026-08-31");
    expect(formatOpenerTransferDay("2026-08-03")).toBe("Aug 3, 2026");
  });
});
