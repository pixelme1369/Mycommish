/**
 * Commission period for the next upcoming payday (25th).
 * Example: before Aug 25 → `2026-07` (paid Aug 25); on/after Aug 25 → `2026-08`.
 */
export function periodLabelForNextPayDate(asOf: Date = new Date()): string {
  const y = asOf.getFullYear();
  const m = asOf.getMonth(); // 0–11
  const day = asOf.getDate();
  if (day < 25) {
    // Next payday is the 25th of this month → reimburses the prior calendar month.
    const periodYear = m === 0 ? y - 1 : y;
    const periodMonth = m === 0 ? 12 : m;
    return `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
  }
  // On/after the 25th → next payday is next month’s 25th → reimburses this calendar month.
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function periodLabelFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parse YYYY-MM-DD as UTC noon to avoid TZ day-shift. */
export function parsePaidOnDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}
