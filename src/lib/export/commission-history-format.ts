/**
 * Commission History sheet shape (same columns as history upload).
 */

export const COMMISSION_HISTORY_HEADERS = [
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
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthNameFromPeriodLabel(periodLabel: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodLabel.trim());
  if (!m) return periodLabel;
  const idx = Number(m[2]) - 1;
  return MONTH_NAMES[idx] ?? periodLabel;
}

/** Fraction rate → sheet label like "1.40%". */
export function rateAsPercentLabel(rate: number): string {
  const pct = Math.round(rate * 10000) / 100;
  return `${pct.toFixed(2)}%`;
}

/**
 * Status for To-subtract / clawback rows — notes when the file was paid
 * and that this export row is the clawback.
 */
export function subtractStatusLabel(paidPeriodLabel: string | null | undefined): string {
  const paidMonth = paidPeriodLabel
    ? monthNameFromPeriodLabel(paidPeriodLabel.trim())
    : null;
  if (paidMonth && paidMonth !== paidPeriodLabel?.trim()) {
    return `Paid ${paidMonth} — now subtracting`;
  }
  if (paidPeriodLabel?.trim()) {
    return `Paid ${paidPeriodLabel.trim()} — now subtracting`;
  }
  return "Previously paid — now subtracting";
}
