import { describe, expect, it } from "vitest";
import {
  AGENT_CLIENT_DETAIL_HEADERS,
  buildDashboardRepRow,
  rateAsPercentNumber,
  splitUnitsForDashboard,
  uniqueSheetName,
} from "./agent-client-details-format";

describe("agent client details export helpers", () => {
  it("formats rate as percent number", () => {
    expect(rateAsPercentNumber(0.0125)).toBe(1.25);
    expect(rateAsPercentNumber(0.02)).toBe(2);
  });

  it("dedupes excel sheet names within 31 chars", () => {
    const used = new Set<string>();
    expect(uniqueSheetName("AJ Valipour", used)).toBe("AJ Valipour");
    expect(uniqueSheetName("AJ Valipour", used)).toBe("AJ Valipour (2)");
    expect(uniqueSheetName("A".repeat(40), used).length).toBeLessThanOrEqual(31);
  });

  it("splits units so Sum of Units + RevShares = Total Units", () => {
    expect(
      splitUnitsForDashboard({ totalClearedUnits: 23, revShareUnits: 1 }),
    ).toEqual({ units: 22, revShares: 1, totalUnits: 23 });
    expect(
      splitUnitsForDashboard({ totalClearedUnits: 10, revShareUnits: 0 }),
    ).toEqual({ units: 10, revShares: 0, totalUnits: 10 });
  });

  it("builds dashboard rep row with negative to-subtract and unit split", () => {
    const row = buildDashboardRepRow({
      salesRep: "Maria",
      enrolledDebt: 100000,
      clawbackAmount: 415.07,
      units: 22,
      revShares: 1,
      tierRate: 0.0125,
      bonus: 100,
      totalCommissions: 11880.31,
    });
    expect(row.toSubtract).toBe(-415.07);
    expect(row.units).toBe(22);
    expect(row.revShares).toBe(1);
    expect(row.totalUnits).toBe(23);
    expect(row.ratePct).toBe(1.25);
  });

  it("uses expected client detail headers", () => {
    expect(AGENT_CLIENT_DETAIL_HEADERS).toContain("Cordoba Clawback");
    expect(AGENT_CLIENT_DETAIL_HEADERS[0]).toBe("Agent Name");
    expect(AGENT_CLIENT_DETAIL_HEADERS).toContain("# NSF");
  });
});
