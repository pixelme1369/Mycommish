import { describe, expect, it } from "vitest";
import { computeNetCommission } from "./net";

describe("computeNetCommission", () => {
  it("adds advances paid and subtracts repayments", () => {
    // July paycheck: 1000 gross, +500 advance against August
    expect(computeNetCommission(1000, 0, 0, 500, 0)).toBe(1500);
    // August: 1200 gross, −500 repay
    expect(computeNetCommission(1200, 0, 0, 0, 500)).toBe(700);
  });

  it("floors at zero when repay exceeds available", () => {
    expect(computeNetCommission(200, 0, 0, 0, 500)).toBe(0);
  });

  it("stacks with clawbacks and manual bonuses", () => {
    expect(computeNetCommission(1000, 100, 50, 200, 75)).toBe(1075);
  });
});
