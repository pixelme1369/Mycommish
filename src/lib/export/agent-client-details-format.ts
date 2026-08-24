/**
 * Agent Client Details export — multi-sheet workbook matching the ops spreadsheet:
 * Dashboard Summary · All Agents · All Chargeback · one sheet per agent.
 */

export const AGENT_CLIENT_DETAIL_HEADERS = [
  "Agent Name",
  "Tier",
  "Rate %",
  "Type",
  "ID",
  "Client Name",
  "Enrolled Date",
  "Enrolled Debt",
  "Status",
  "1st Payment Cleared Date",
  "2nd Payment Cleared Date",
  "Dropped Date",
  "Payments Made",
  "Pay Freq.",
  "# NSF",
  "Credit Score",
  "Commission on Client",
  "Clawback Amount",
  "Cordoba Payout",
  "Cordoba Clawback",
] as const;

/** Fraction rate → percent number for Rate % column (1.25 for 1.25%). */
export function rateAsPercentNumber(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

/**
 * Excel sheet names: max 31 chars; no \ / ? * [ ].
 * Dedupes with " (2)", " (3)", …
 */
export function uniqueSheetName(raw: string, used: Set<string>): string {
  const cleaned = (raw || "Agent")
    .replace(/[\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  let name = cleaned || "Agent";
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  let n = 2;
  while (n < 100) {
    const suffix = ` (${n})`;
    const base = cleaned.slice(0, Math.max(1, 31 - suffix.length));
    name = `${base}${suffix}`;
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase());
      return name;
    }
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export type DashboardRepRow = {
  salesRep: string;
  enrolledDebt: number;
  toSubtract: number;
  units: number;
  revShares: number;
  totalUnits: number;
  ratePct: number;
  upscore: number;
  bonus: number;
  totalCommissions: number;
};

/**
 * Dashboard unit split:
 * - Sum of Units = cleared files that pay commission (FICO ≥ 500 / not low-credit)
 * - RevShares = cleared files with FICO < 500 (low-credit, $0 commission units)
 * - Total Units = Sum of Units + RevShares
 */
export function splitUnitsForDashboard(opts: {
  /** All cleared / paid unit count for the agent this period (includes low-credit). */
  totalClearedUnits: number;
  /** Cleared files with Credit Score < 500 (or low_credit_cleared). */
  revShareUnits: number;
}): { units: number; revShares: number; totalUnits: number } {
  const revShares = Math.max(0, Math.min(opts.revShareUnits, opts.totalClearedUnits));
  const totalUnits = Math.max(0, opts.totalClearedUnits);
  const units = Math.max(0, totalUnits - revShares);
  return { units, revShares, totalUnits };
}

export function buildDashboardRepRow(opts: {
  salesRep: string;
  enrolledDebt: number;
  clawbackAmount: number;
  /** Paying units (not low-credit). */
  units: number;
  /** Low-credit / FICO < 500 units. */
  revShares?: number;
  tierRate: number;
  upscore?: number;
  bonus: number;
  totalCommissions: number;
}): DashboardRepRow {
  const revShares = opts.revShares ?? 0;
  const toSubtract = opts.clawbackAmount > 0 ? -Math.abs(opts.clawbackAmount) : 0;
  return {
    salesRep: opts.salesRep,
    enrolledDebt: opts.enrolledDebt,
    toSubtract,
    units: opts.units,
    revShares,
    totalUnits: opts.units + revShares,
    ratePct: rateAsPercentNumber(opts.tierRate),
    upscore: opts.upscore ?? 0,
    bonus: opts.bonus,
    totalCommissions: opts.totalCommissions,
  };
}
