import { describe, expect, it, vi } from "vitest";
import { PeriodStatus } from "@/generated/prisma/client";
import { isCalculatedPeriodLocked } from "./period-lock";

vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("isCalculatedPeriodLocked", () => {
  const asOf = new Date("2026-09-05T12:00:00Z");

  it("locks a closed status even before payday", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.closed,
        periodLabel: "2026-08",
        asOf,
      }),
    ).toBe(true);
  });

  it("locks after payday even if status is still open", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        periodLabel: "2026-07",
        asOf,
      }),
    ).toBe(true);
  });

  it("locks when History (logged as paid) exists, even before payday", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        periodLabel: "2026-08",
        hasHistory: true,
        asOf,
      }),
    ).toBe(true);
  });

  it("leaves a live unpaid month rewriteable", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        periodLabel: "2026-08",
        hasHistory: false,
        asOf,
      }),
    ).toBe(false);
  });
});
