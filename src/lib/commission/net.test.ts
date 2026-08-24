import { describe, expect, it } from "vitest";
import { computeNetCommission, computeTeamLeadBonusAmount } from "./net";

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

  it("includes team-lead bonus in net", () => {
    // 1000 gross − 0 clawback + 0 manual + 0 advance − 0 repay + 40 team = 1040
    expect(computeNetCommission(1000, 0, 0, 0, 0, 40)).toBe(1040);
  });
});

describe("computeTeamLeadBonusAmount", () => {
  it("multiplies units by rate", () => {
    expect(computeTeamLeadBonusAmount(8, 5)).toBe(40);
    expect(computeTeamLeadBonusAmount(3, 5.5)).toBe(16.5);
  });

  it("returns 0 for empty team or zero rate", () => {
    expect(computeTeamLeadBonusAmount(0, 5)).toBe(0);
    expect(computeTeamLeadBonusAmount(10, 0)).toBe(0);
    expect(computeTeamLeadBonusAmount(-1, 5)).toBe(0);
  });
});
