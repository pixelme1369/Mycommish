import { describe, expect, it, vi } from "vitest";
import { PeriodStatus } from "@/generated/prisma/client";
import { isCalculatedPeriodLocked } from "./period-lock";

vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("isCalculatedPeriodLocked", () => {
  it("locks a closed status", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.closed,
      }),
    ).toBe(true);
  });

  it("does not lock after payday if not logged as paid", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        hasHistory: false,
      }),
    ).toBe(false);
  });

  it("locks when History (logged as paid) exists", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        hasHistory: true,
      }),
    ).toBe(true);
  });

  it("leaves an unpaid open month rewriteable", () => {
    expect(
      isCalculatedPeriodLocked({
        status: PeriodStatus.open,
        hasHistory: false,
      }),
    ).toBe(false);
  });
});
