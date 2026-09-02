export const OPENER_LOG_SHEET = "Opener Transfer Log";
export const OPENER_SUMMARY_SHEET = "Monthly Summary";

export const OPENER_LOG_HEADERS = [
  "Date",
  "Opener",
  "File ID",
  "Debt Load",
  "Stage (CRM)",
  "Status (CRM)",
  "Commission",
  "Pay Status",
  "Notes",
] as const;

export const OPENER_SUMMARY_HEADERS = [
  "Opener",
  "Approved Transfers",
  "Commission Total",
  "Bonus / Upscore [Admin fills in]",
  "Total Payout",
  "Excluded (Canceled)",
  "Pending CRM Review",
] as const;

export function formatYmdSlash(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${m}/${d}/${y}`;
}

export function openerExportFilename(monthLabel: string): string {
  const safe = /^\d{4}-\d{2}$/.test(monthLabel) ? monthLabel : "period";
  return `opener-payout-${safe}.xlsx`;
}
