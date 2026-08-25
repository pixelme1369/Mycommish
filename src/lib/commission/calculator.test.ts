import { describe, expect, it } from "vitest";
import {
  agentStatementSignOpensAt,
  calculateAgentCommission,
  calculateClawbackAmount,
  canAgentSignStatementForPeriod,
  commissionGainAtNextTier,
  getFixedRate,
  getTier,
  isPeriodClosedByPayday,
  paymentDateForPeriod,
  unitsToNextTier,
} from "./calculator";

describe("tiers", () => {
  it("60 units = Tier 5", () => {
    expect(getTier(60).tier).toBe(5);
    expect(getTier(60).rate).toBe(0.02);
  });
  it("61+ = Tier 6", () => {
    expect(getTier(61).tier).toBe(6);
  });
  it("rejects zero", () => {
    expect(() => getTier(0)).toThrow();
  });
});

describe("fixed rates", () => {
  it("Alex / Peter", () => {
    expect(getFixedRate("Alex Tambouly")).toBe(0.02);
    expect(getFixedRate(" peter godwin ")).toBe(0.0175);
  });
  it("ignores cancellation penalty", () => {
    const r = calculateAgentCommission({
      agentName: "Alex Tambouly",
      unitsCleared: 25,
      totalClearedDebt: 100_000,
      cancellationRatePct: 50,
    });
    expect(r.tierRate).toBe(0.02);
    expect(r.cancellationPenaltyApplied).toBe(false);
    expect(r.grossCommission).toBe(2000);
  });
});

describe("Artin Namjoo legacy tiers", () => {
  it("uses grandfathered unit bands", () => {
    expect(getTier(15, "Artin Namjoo")).toEqual({
      tier: 1,
      rate: 0.01,
      label: "Legacy Tier 1",
    });
    expect(getTier(16, "Artin Namjoo").rate).toBe(0.0125);
    expect(getTier(22, "Artin Namjoo").rate).toBe(0.015);
    expect(getTier(30, "Artin Namjoo").rate).toBe(0.0175);
    expect(getTier(36, "Artin Namjoo").rate).toBe(0.02);
    expect(getTier(41, "Artin Namjoo").rate).toBe(0.0225);
  });

  it("does not use standard bands for Artin", () => {
    // 20 units: Artin = Legacy Tier 2 (1.25%); standard = Tier 1 (1%)
    expect(getTier(20, "Artin Namjoo").rate).toBe(0.0125);
    expect(getTier(20).rate).toBe(0.01);
  });

  it("applies cancellation penalty on his ladder", () => {
    const r = calculateAgentCommission({
      agentName: "Artin Namjoo",
      unitsCleared: 20, // Legacy Tier 2 @ 1.25%
      totalClearedDebt: 100_000,
      cancellationRatePct: 30,
    });
    expect(r.rawTier).toBe(2);
    expect(r.adjustedTier).toBe(1);
    expect(r.tierRate).toBe(0.01);
    expect(r.cancellationPenaltyApplied).toBe(true);
    expect(r.notes).toMatch(/grandfathered ladder/i);
  });

  it("units to next follows legacy thresholds", () => {
    expect(unitsToNextTier(15, "Artin Namjoo")).toBe(1); // → 16
    expect(unitsToNextTier(21, "Artin Namjoo")).toBe(1); // → 22
    expect(unitsToNextTier(41, "Artin Namjoo")).toBeNull();
  });
});

describe("cancellation penalty", () => {
  it("exactly 25% does not drop", () => {
    const r = calculateAgentCommission({
      agentName: "Test",
      unitsCleared: 25,
      totalClearedDebt: 100_000,
      cancellationRatePct: 25,
    });
    expect(r.adjustedTier).toBe(2);
    expect(r.cancellationPenaltyApplied).toBe(false);
  });
  it(">25% drops one tier", () => {
    const r = calculateAgentCommission({
      agentName: "Test",
      unitsCleared: 25,
      totalClearedDebt: 100_000,
      cancellationRatePct: 25.01,
    });
    expect(r.adjustedTier).toBe(1);
    expect(r.tierRate).toBe(0.01);
  });
});

describe("clawback", () => {
  it("fixed rate ignores units shortcut", () => {
    const cb = calculateClawbackAmount(1, 10000, 0, 0, 10000, "Alex Tambouly");
    expect(cb).toBe(200);
  });
  it("single unit claws full gross", () => {
    const cb = calculateClawbackAmount(1, 10000, 100, 0, 10000, "Test");
    expect(cb).toBe(100);
  });
});

describe("payday", () => {
  it("May → June 25", () => {
    expect(paymentDateForPeriod("2026-05").toISOString().startsWith("2026-06-25")).toBe(true);
  });
  it("closed after payday", () => {
    expect(isPeriodClosedByPayday("2026-05", new Date("2026-06-25T00:00:00Z"))).toBe(true);
    expect(isPeriodClosedByPayday("2026-05", new Date("2026-06-24T23:59:59Z"))).toBe(false);
  });
});

describe("agent statement sign window", () => {
  it("opens 7 days before payday", () => {
    // July period → Aug 25 payday → opens Aug 18
    expect(agentStatementSignOpensAt("2026-07").toISOString().startsWith("2026-08-18")).toBe(
      true,
    );
  });
  it("blocks before the window", () => {
    expect(
      canAgentSignStatementForPeriod("2026-07", new Date("2026-08-17T23:59:59Z")),
    ).toBe(false);
  });
  it("allows on the open day and after", () => {
    expect(
      canAgentSignStatementForPeriod("2026-07", new Date("2026-08-18T00:00:00Z")),
    ).toBe(true);
    expect(
      canAgentSignStatementForPeriod("2026-07", new Date("2026-08-25T12:00:00Z")),
    ).toBe(true);
  });
});

describe("unitsToNextTier", () => {
  it.each([
    [1, 20],
    [20, 1],
    [21, 11],
    [31, 1],
    [32, 8],
    [39, 1],
    [40, 6],
    [45, 1],
    [46, 15],
    [60, 1],
  ] as const)("%i units → %i to next", (units, needed) => {
    expect(unitsToNextTier(units)).toBe(needed);
  });

  it("top tier has no next", () => {
    expect(unitsToNextTier(61)).toBeNull();
    expect(unitsToNextTier(500)).toBeNull();
  });

  it("zero units needs 1 for tier 1", () => {
    expect(unitsToNextTier(0)).toBe(1);
  });

  it("fixed-rate agents have no next tier", () => {
    expect(unitsToNextTier(5, "Alex Tambouly")).toBeNull();
    expect(unitsToNextTier(5, "  peter GODWIN  ")).toBeNull();
  });
});

describe("commissionGainAtNextTier", () => {
  it("gain on same debt at next tier rate", () => {
    const gain = commissionGainAtNextTier(2, 979_124.61, 12_239.06);
    expect(gain).toBeCloseTo(2_447.81, 2);
  });

  it("top / zero / fixed have no gain", () => {
    expect(commissionGainAtNextTier(6, 1_000_000, 22_500)).toBeNull();
    expect(commissionGainAtNextTier(0, 100_000, 0)).toBeNull();
    expect(commissionGainAtNextTier(1, 100_000, 2_000, "Alex Tambouly")).toBeNull();
  });
});
