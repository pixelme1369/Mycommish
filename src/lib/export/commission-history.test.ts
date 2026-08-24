import { describe, expect, it } from "vitest";
import {
  COMMISSION_HISTORY_HEADERS,
  monthNameFromPeriodLabel,
  rateAsPercentLabel,
  subtractStatusLabel,
} from "./commission-history-format";

describe("commission history export helpers", () => {
  it("maps periodLabel to month name", () => {
    expect(monthNameFromPeriodLabel("2026-01")).toBe("January");
    expect(monthNameFromPeriodLabel("2026-08")).toBe("August");
    expect(monthNameFromPeriodLabel("2026-12")).toBe("December");
  });

  it("formats rate as percent label", () => {
    expect(rateAsPercentLabel(0.014)).toBe("1.40%");
    expect(rateAsPercentLabel(0.0125)).toBe("1.25%");
  });

  it("labels subtract rows with when the file was paid", () => {
    expect(subtractStatusLabel("2026-01")).toBe("Paid January — now subtracting");
    expect(subtractStatusLabel("2025-08")).toBe("Paid August — now subtracting");
    expect(subtractStatusLabel(null)).toBe("Previously paid — now subtracting");
    expect(subtractStatusLabel("")).toBe("Previously paid — now subtracting");
  });

  it("uses history sheet column headers", () => {
    expect([...COMMISSION_HISTORY_HEADERS]).toEqual([
      "Month",
      "ID",
      "Sales Rep",
      "Full Name",
      "Enrolled Debt",
      "To subtract",
      "Payments Made",
      "Units",
      "Status",
      "Rate",
      "Agent Month File Count",
      "Commission on Client",
    ]);
  });
});
