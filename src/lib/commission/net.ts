/** Net pay: gross − clawbacks + approved manual bonuses (floored at 0). */
export function computeNetCommission(
  grossCommission: number,
  clawbackAmount: number,
  manualBonusAmount = 0,
): number {
  return Math.max(
    0,
    Math.round((grossCommission - clawbackAmount + manualBonusAmount) * 100) / 100,
  );
}
