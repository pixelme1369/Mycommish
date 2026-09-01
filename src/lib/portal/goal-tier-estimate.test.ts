import { describe, expect, it } from "vitest";
import {
  bandRange,
  enrollmentPayPreview,
  pickCommissionAgentName,
} from "./goal-tier-estimate";

describe("enrollmentPayPreview", () => {
  it("uses standard tier % × enrolled debt", () => {
    const now = enrollmentPayPreview("AJ Valipour", 1, 43_359);
    expect(now.rate).toBe(0.01);
    expect(now.pay).toBe(433.59);
    expect(now.tier).toBe(1);

    const atGoal = enrollmentPayPreview("AJ Valipour", 35, 1_500_000);
    expect(atGoal.rate).toBe(0.015);
    expect(atGoal.pay).toBe(22_500);
    expect(atGoal.label).toMatch(/Tier 3/);
  });

  it("uses Peter / Alex contract % instead of the ladder", () => {
    const r = enrollmentPayPreview("Peter Godwin", 10, 100_000);
    expect(r.fixed).toBe(true);
    expect(r.rate).toBe(0.0175);
    expect(r.pay).toBe(1750);
  });

  it("uses Artin's grandfathered bands", () => {
    const r = enrollmentPayPreview("Artin Namjoo", 16, 80_000);
    expect(r.tier).toBe(2);
    expect(r.rate).toBe(0.0125);
    expect(r.pay).toBe(1000);
  });

  it("is $0 before the first enrolled file", () => {
    const r = enrollmentPayPreview("AJ Valipour", 0, 0);
    expect(r.pay).toBe(0);
    expect(r.tier).toBeNull();
  });
});

describe("pickCommissionAgentName", () => {
  it("prefers a fixed-rate alias", () => {
    expect(pickCommissionAgentName(["AJ Valipour", "Peter Godwin"])).toBe(
      "Peter Godwin",
    );
  });
});

describe("bandRange", () => {
  it("formats open top bands", () => {
    expect(bandRange({ low: 61, high: null, rate: 0.0225, label: "T6" })).toBe(
      "61+",
    );
  });
});
