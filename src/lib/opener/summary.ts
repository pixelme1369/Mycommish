import { OPENER_PAY_APPROVED, OPENER_PAY_EXCLUDED } from "@/lib/opener/payout";

export type OpenerLogCounts = {
  approvedTransfers: number;
  commissionTotal: number;
  excludedCanceled: number;
  pendingCrmReview: number;
  logCount: number;
};

export function emptyOpenerLogCounts(): OpenerLogCounts {
  return {
    approvedTransfers: 0,
    commissionTotal: 0,
    excludedCanceled: 0,
    pendingCrmReview: 0,
    logCount: 0,
  };
}

export function addOpenerLogToCounts(
  counts: OpenerLogCounts,
  row: { payStatus: string; commission: number; unmatched: boolean },
): void {
  counts.logCount += 1;
  if (row.unmatched) counts.pendingCrmReview += 1;
  if (row.payStatus === OPENER_PAY_APPROVED) {
    counts.approvedTransfers += 1;
    counts.commissionTotal += row.commission;
    return;
  }
  if (row.payStatus === OPENER_PAY_EXCLUDED && !row.unmatched) {
    counts.excludedCanceled += 1;
  }
}

export function parseOpenerMoneyInput(raw: string): number | null {
  const n = Number.parseFloat(
    String(raw || "")
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .trim(),
  );
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function sanitizeOpenerNotes(raw: string): string {
  return String(raw || "").trim().slice(0, 500);
}
