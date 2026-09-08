import { describe, expect, it } from "vitest";
import {
  agentInactiveAtClear,
  calculateDirectorOverride,
  isAlexDirectorPlan,
  parseDirectorOverrideNote,
  personalProductionProgress,
} from "./director-plan";

describe("isAlexDirectorPlan", () => {
  it("starts 2026-09 for Alex only", () => {
    expect(isAlexDirectorPlan("Alex Tambouly", "2026-08")).toBe(false);
    expect(isAlexDirectorPlan("Alex Tambouly", "2026-09")).toBe(true);
    expect(isAlexDirectorPlan(" alex tambouly ", "2026-12")).toBe(true);
    expect(isAlexDirectorPlan("Peter Godwin", "2026-09")).toBe(false);
    expect(isAlexDirectorPlan("Alex Tambouly", "")).toBe(false);
    expect(isAlexDirectorPlan("Alex Tambouly", null)).toBe(false);
  });
});

describe("personalProductionProgress", () => {
  it("shows full $1.25M remaining at $0", () => {
    const p = personalProductionProgress(0);
    expect(p.met).toBe(false);
    expect(p.remaining).toBe(1_250_000);
    expect(p.pct).toBe(0);
  });

  it("tracks partial progress", () => {
    const p = personalProductionProgress(625_000);
    expect(p.met).toBe(false);
    expect(p.remaining).toBe(625_000);
    expect(p.pct).toBe(50);
  });

  it("marks met at or above target", () => {
    expect(personalProductionProgress(1_250_000).met).toBe(true);
    expect(personalProductionProgress(1_400_000).remaining).toBe(0);
  });
});

describe("calculateDirectorOverride", () => {
  it("prices 1,600 files marginally at standard rates", () => {
    const r = calculateDirectorOverride({
      companySurvivingFiles: 1600,
      personalCancelRatePct: 10,
    });
    expect(r.penaltyApplied).toBe(false);
    expect(r.slices).toEqual([
      { label: "Band 1", files: 1000, rate: 28, amount: 28000 },
      { label: "Band 2", files: 500, rate: 20, amount: 10000 },
      { label: "Band 3", files: 100, rate: 15, amount: 1500 },
    ]);
    expect(r.amount).toBe(39500);
  });

  it("prices 1,000 files at Band 1", () => {
    const r = calculateDirectorOverride({
      companySurvivingFiles: 1000,
      personalCancelRatePct: 0,
    });
    expect(r.amount).toBe(28000);
    expect(r.slices).toEqual([{ label: "Band 1", files: 1000, rate: 28, amount: 28000 }]);
  });

  it("drops every band $5 when personal cancel > 25%", () => {
    const r = calculateDirectorOverride({
      companySurvivingFiles: 1000,
      personalCancelRatePct: 25.01,
    });
    expect(r.penaltyApplied).toBe(true);
    expect(r.amount).toBe(23000);
    expect(r.slices[0]?.rate).toBe(23);
  });

  it("does not haircut at exactly 25%", () => {
    const r = calculateDirectorOverride({
      companySurvivingFiles: 1000,
      personalCancelRatePct: 25,
    });
    expect(r.penaltyApplied).toBe(false);
    expect(r.amount).toBe(28000);
  });

  it("does not reprice the whole month at the landed band", () => {
    const at1000 = calculateDirectorOverride({
      companySurvivingFiles: 1000,
      personalCancelRatePct: 0,
    });
    const at1001 = calculateDirectorOverride({
      companySurvivingFiles: 1001,
      personalCancelRatePct: 0,
    });
    expect(at1001.amount - at1000.amount).toBe(20);
  });

  it("returns 0 for no files", () => {
    expect(
      calculateDirectorOverride({ companySurvivingFiles: 0, personalCancelRatePct: 40 }).amount,
    ).toBe(0);
  });

  it("round-trips the ledger note", () => {
    const r = calculateDirectorOverride({
      companySurvivingFiles: 1600,
      personalCancelRatePct: 30,
    });
    const parsed = parseDirectorOverrideNote(r.note);
    expect(parsed).toEqual({
      companyFiles: 1600,
      penaltyApplied: true,
      amount: r.amount,
    });
  });
});

describe("agentInactiveAtClear", () => {
  it("counts a file cleared before dismiss", () => {
    expect(
      agentInactiveAtClear({
        clearAt: new Date("2026-09-10T00:00:00Z"),
        dismissedAt: new Date("2026-09-15T18:00:00Z"),
      }),
    ).toBe(false);
  });

  it("excludes a file cleared on or after dismiss day", () => {
    expect(
      agentInactiveAtClear({
        clearAt: new Date("2026-09-15T00:00:00Z"),
        dismissedAt: new Date("2026-09-15T18:00:00Z"),
      }),
    ).toBe(true);
  });

  it("excludes when there is no clear date but they are dismissed", () => {
    expect(
      agentInactiveAtClear({
        clearAt: null,
        dismissedAt: new Date("2026-09-01T00:00:00Z"),
      }),
    ).toBe(true);
  });
});
