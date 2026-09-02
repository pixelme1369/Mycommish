import { describe, expect, it } from "vitest";
import { ClientEventKind } from "@/generated/prisma/client";
import {
  commissionOnFile,
  isLastCheckClawback,
  lastCheckCommission,
  lastCheckGustoAmount,
  lastCheckPaymentsVsThreshold,
  lastCheckSecondClearLabel,
  passedLastCheckThreshold,
  wouldHaveBeenPaidCommission,
} from "./last-check";

describe("wouldHaveBeenPaidCommission", () => {
  it("counts cleared and safe-cancel files, not pending or clawbacks", () => {
    expect(
      wouldHaveBeenPaidCommission({
        kind: ClientEventKind.cleared,
        isCleared: true,
        clawbackApplied: false,
      }),
    ).toBe(true);
    expect(
      wouldHaveBeenPaidCommission({
        kind: ClientEventKind.safe_cancel,
        isCleared: true,
        clawbackApplied: false,
      }),
    ).toBe(true);
    expect(
      wouldHaveBeenPaidCommission({
        kind: ClientEventKind.pending,
        isCleared: false,
        clawbackApplied: false,
      }),
    ).toBe(false);
    expect(
      wouldHaveBeenPaidCommission({
        kind: ClientEventKind.cleared,
        isCleared: true,
        clawbackApplied: true,
      }),
    ).toBe(false);
  });
});

describe("isLastCheckClawback", () => {
  it("includes CRM and Cordoba clawback rows", () => {
    expect(
      isLastCheckClawback({
        kind: ClientEventKind.clawback,
        clawbackApplied: true,
      }),
    ).toBe(true);
    expect(
      isLastCheckClawback({
        kind: ClientEventKind.cordoba_clawback,
        clawbackApplied: false,
      }),
    ).toBe(true);
    expect(
      isLastCheckClawback({
        kind: ClientEventKind.cleared,
        clawbackApplied: false,
      }),
    ).toBe(false);
  });
});

describe("passedLastCheckThreshold", () => {
  it("rejects bi-weekly with only 2 payments even if 2nd clear exists", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-08-18",
        secondPaymentClearedDate: "2026-08-25",
        payFreq: "Bi-Weekly",
        paymentsMade: 2,
      }),
    ).toBe(false);
  });

  it("accepts monthly with 2 payments and a 2nd clear date in a later month", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-08-04",
        secondPaymentClearedDate: "2026-09-02",
        payFreq: "Monthly",
        paymentsMade: 2,
      }),
    ).toBe(true);
  });

  it("rejects monthly with 2 payments but no 2nd clear date", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-08-04",
        secondPaymentClearedDate: null,
        payFreq: "Monthly",
        paymentsMade: 2,
      }),
    ).toBe(false);
  });

  it("only counts files whose 1st payment cleared in that period", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-09-01",
        secondPaymentClearedDate: "2026-09-02",
        payFreq: "Monthly",
        paymentsMade: 2,
      }),
    ).toBe(false);
  });

  it("accepts bi-weekly once 4 payments are made", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-08-18",
        secondPaymentClearedDate: "2026-08-25",
        payFreq: "Bi-Weekly",
        paymentsMade: 4,
      }),
    ).toBe(true);
  });

  it("skips clawbacks", () => {
    expect(
      passedLastCheckThreshold({
        periodLabel: "2026-08",
        firstPaymentClearedDate: "2026-08-04",
        secondPaymentClearedDate: "2026-09-02",
        payFreq: "Monthly",
        paymentsMade: 2,
        kind: ClientEventKind.clawback,
        clawbackApplied: true,
      }),
    ).toBe(false);
  });
});

describe("last check commission", () => {
  it("uses those units for tier and debt × rate", () => {
    const result = lastCheckCommission({
      agentName: "Test Agent",
      unitsCleared: 25,
      totalClearedDebt: 1_000_000,
      cancellationRatePct: 5,
    });
    expect(result).not.toBeNull();
    expect(result!.adjustedTier).toBe(2);
    expect(result!.tierRate).toBe(0.0125);
    expect(result!.grossCommission).toBe(12_500);
    expect(commissionOnFile(40_000, 0.0125)).toBe(500);
  });

  it("returns null when no files passed threshold", () => {
    expect(
      lastCheckCommission({
        agentName: "Test Agent",
        unitsCleared: 0,
        totalClearedDebt: 0,
        cancellationRatePct: 0,
      }),
    ).toBeNull();
  });

  it("gusto amount is gross minus clawbacks", () => {
    expect(
      lastCheckGustoAmount({ grossCommission: 12_500, clawbackAmount: 500 }),
    ).toBe(12_000);
  });
});

describe("last check threshold columns", () => {
  it("monthly needs 2 payments, bi-weekly needs 4", () => {
    expect(lastCheckPaymentsVsThreshold(2, "Monthly")).toEqual({
      made: 2,
      needed: 2,
      passed: true,
    });
    expect(lastCheckPaymentsVsThreshold(2, "Bi-Weekly")).toEqual({
      made: 2,
      needed: 4,
      passed: false,
    });
    expect(lastCheckPaymentsVsThreshold(4, "Semi-Monthly").passed).toBe(true);
  });

  it("shows the 2nd clear date when present", () => {
    expect(lastCheckSecondClearLabel("2026-09-02")).toBe("2026-09-02");
    expect(lastCheckSecondClearLabel(null)).toBe("—");
  });
});
