/** Net pay: gross − clawbacks + manual bonuses + advances paid − advance repayments (floored at 0). */
export function computeNetCommission(
  grossCommission: number,
  clawbackAmount: number,
  manualBonusAmount = 0,
  advancePaidAmount = 0,
  advanceRepayAmount = 0,
): number {
  return Math.max(
    0,
    Math.round(
      (grossCommission -
        clawbackAmount +
        manualBonusAmount +
        advancePaidAmount -
        advanceRepayAmount) *
        100,
    ) / 100,
  );
}
