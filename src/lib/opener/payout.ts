import { paymentDateForPeriod } from "@/lib/commission/calculator";

export const OPENER_PAY_APPROVED = "approved" as const;
export const OPENER_PAY_EXCLUDED = "excluded_canceled" as const;
export type OpenerPayStatusName =
  | typeof OPENER_PAY_APPROVED
  | typeof OPENER_PAY_EXCLUDED;

/** Statuses that pay. Anything else is Excluded - Canceled. */
const APPROVED_STATUSES = new Set(["active", "waiting for first payment"]);

export function normalizeForthId(raw: string): string {
  return raw.trim();
}

export function openerPayoutForDebt(debtLoad: number): number | null {
  if (!Number.isFinite(debtLoad) || debtLoad < 5_000) return null;
  if (debtLoad < 25_000) return 15;
  if (debtLoad < 45_000) return 30;
  return 50;
}

export function openerPayStatusFromForthStatus(
  status: string | null | undefined,
): OpenerPayStatusName {
  const key = (status || "").trim().toLowerCase();
  return APPROVED_STATUSES.has(key) ? OPENER_PAY_APPROVED : OPENER_PAY_EXCLUDED;
}

export function formatOpenerPayStatus(status: OpenerPayStatusName): string {
  return status === OPENER_PAY_APPROVED ? "Approved" : "Excluded - Canceled";
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** Calendar month of the opener-entered date → same period key as agent commissions (YYYY-MM). */
export function openerPeriodFromYmd(ymd: string): string {
  return (ymd || "").slice(0, 7);
}

/** Previous calendar month as YYYY-MM (January → prior December). */
export function previousOpenerMonthLabel(monthLabel: string): string {
  if (!MONTH.test(monthLabel)) return monthLabel;
  const [y, m] = monthLabel.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First and last calendar day of a YYYY-MM pay month. */
export function openerMonthYmdRange(
  monthLabel: string,
): { min: string; max: string } | null {
  if (!MONTH.test(monthLabel)) return null;
  const [y, m] = monthLabel.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    min: `${monthLabel}-01`,
    max: `${monthLabel}-${String(last).padStart(2, "0")}`,
  };
}

export function ymdInOpenerMonth(ymd: string, monthLabel: string): boolean {
  return YMD.test(ymd) && openerPeriodFromYmd(ymd) === monthLabel;
}

/** Every calendar day in a YYYY-MM pay month, as YYYY-MM-DD. */
export function openerMonthDays(monthLabel: string): string[] {
  const range = openerMonthYmdRange(monthLabel);
  if (!range) return [];
  const days: string[] = [];
  for (let d = 1; ; d++) {
    const ymd = `${monthLabel}-${String(d).padStart(2, "0")}`;
    if (ymd > range.max) break;
    days.push(ymd);
  }
  return days;
}

export function formatOpenerTransferDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Keep a date inside the selected pay month (for the date picker default). */
export function clampYmdToOpenerMonth(ymd: string, monthLabel: string): string {
  const range = openerMonthYmdRange(monthLabel);
  if (!range) return ymd;
  if (!YMD.test(ymd) || ymd < range.min) return range.min;
  if (ymd > range.max) return range.max;
  return ymd;
}

export function formatOpenerPeriodName(periodLabel: string): string {
  const [y, m] = periodLabel.split("-").map(Number);
  if (!y || !m) return periodLabel;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Same rule as agents: period month pays on the 25th of the following month. */
export function formatOpenerPayDate(periodLabel: string): string {
  return paymentDateForPeriod(periodLabel).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type OpenerForthSnapshot = {
  debtLoad: number;
  stageTitle: string | null;
  status: string | null;
  commission: number;
  payStatus: OpenerPayStatusName;
  unmatched: boolean;
};

export function openerSnapshotFromForth(
  contact: {
    enrolledAmount: number | string | { toString(): string };
    stageTitle: string | null;
    status: string | null;
  } | null,
): OpenerForthSnapshot {
  if (!contact) {
    return {
      debtLoad: 0,
      stageTitle: null,
      status: null,
      commission: 0,
      payStatus: OPENER_PAY_EXCLUDED,
      unmatched: true,
    };
  }
  const debtLoad = Number(contact.enrolledAmount) || 0;
  return {
    debtLoad,
    stageTitle: contact.stageTitle,
    status: contact.status,
    commission: openerPayoutForDebt(debtLoad) ?? 0,
    payStatus: openerPayStatusFromForthStatus(contact.status),
    unmatched: false,
  };
}
