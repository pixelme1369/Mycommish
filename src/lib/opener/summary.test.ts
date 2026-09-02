import { describe, expect, it } from "vitest";
import {
  OPENER_PAY_APPROVED,
  OPENER_PAY_EXCLUDED,
} from "./payout";
import {
  addOpenerLogToCounts,
  emptyOpenerLogCounts,
  parseOpenerMoneyInput,
  sanitizeOpenerNotes,
} from "./summary";

describe("addOpenerLogToCounts", () => {
  it("counts approved commission and ignores unmatched as excluded", () => {
    const c = emptyOpenerLogCounts();
    addOpenerLogToCounts(c, {
      payStatus: OPENER_PAY_APPROVED,
      commission: 30,
      unmatched: false,
    });
    addOpenerLogToCounts(c, {
      payStatus: OPENER_PAY_EXCLUDED,
      commission: 0,
      unmatched: false,
    });
    addOpenerLogToCounts(c, {
      payStatus: OPENER_PAY_EXCLUDED,
      commission: 0,
      unmatched: true,
    });
    expect(c.approvedTransfers).toBe(1);
    expect(c.commissionTotal).toBe(30);
    expect(c.excludedCanceled).toBe(1);
    expect(c.pendingCrmReview).toBe(1);
    expect(c.logCount).toBe(3);
  });
});

describe("parseOpenerMoneyInput", () => {
  it("parses dollar strings", () => {
    expect(parseOpenerMoneyInput("$1,250.50")).toBe(1250.5);
    expect(parseOpenerMoneyInput("0")).toBe(0);
    expect(parseOpenerMoneyInput("-1")).toBeNull();
    expect(parseOpenerMoneyInput("abc")).toBeNull();
  });
});

describe("sanitizeOpenerNotes", () => {
  it("trims and caps length", () => {
    expect(sanitizeOpenerNotes("  hi  ")).toBe("hi");
    expect(sanitizeOpenerNotes("x".repeat(600)).length).toBe(500);
  });
});
