/** Clawback dollars from enrolled debt × paid rate (fraction, e.g. 0.0175). */
export function clawbackAmountFromPaidRate(
  enrolledDebt: number,
  paidRate: number,
): number {
  if (!(enrolledDebt > 0) || !(paidRate > 0)) return 0;
  return Math.round(enrolledDebt * paidRate * 100) / 100;
}

/**
 * Parse super-admin rate input as a fraction.
 * Accepts "1.75", "1.75%", or already-fraction "0.0175" when ≤ 0.2.
 */
export function parsePaidRatePercentInput(raw: string): number | null {
  const cleaned = String(raw || "")
    .trim()
    .replace(/%/g, "")
    .replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Values > 0.2 are treated as percent points (1.75 → 0.0175).
  // Tiny fractions like 0.0175 stay as-is.
  const fraction = n > 0.2 ? n / 100 : n;
  if (fraction <= 0 || fraction > 0.1) return null; // sanity: ≤ 10%
  return Math.round(fraction * 1_000_000) / 1_000_000;
}
