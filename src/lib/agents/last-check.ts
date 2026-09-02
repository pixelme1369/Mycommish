import { ClientEventKind } from "@/generated/prisma/client";
import {
  calculateAgentCommission,
  getFixedRate,
  type AgentCommissionResult,
} from "@/lib/commission/calculator";
import { computeNetCommission } from "@/lib/commission/net";
import {
  isMonthlyPayFreq,
  parseDate,
  periodOf,
  safePaymentThreshold,
} from "@/lib/commission/crm-parser";

const SKIP_PAY_KINDS = new Set<ClientEventKind>([
  ClientEventKind.clawback,
  ClientEventKind.cordoba_clawback,
  ClientEventKind.same_month_cancel,
  ClientEventKind.pending,
]);

const CLAWBACK_KINDS = new Set<ClientEventKind>([
  ClientEventKind.clawback,
  ClientEventKind.cordoba_clawback,
]);

export function lastCheckPaymentsVsThreshold(
  paymentsMade: number,
  payFreq: string | null | undefined,
): { made: number; needed: number; passed: boolean } {
  const needed = safePaymentThreshold(payFreq);
  const made = Number.isFinite(paymentsMade) ? paymentsMade : 0;
  return { made, needed, passed: made >= needed };
}

/** Files that would have been on the upcoming period paycheck. */
export function wouldHaveBeenPaidCommission(row: {
  kind: ClientEventKind;
  isCleared: boolean;
  clawbackApplied: boolean;
}): boolean {
  if (row.clawbackApplied) return false;
  if (SKIP_PAY_KINDS.has(row.kind)) return false;
  if (row.kind === ClientEventKind.cleared) return true;
  if (row.kind === ClientEventKind.low_credit_cleared) return true;
  if (row.kind === ClientEventKind.safe_cancel) return true;
  if (row.isCleared) return true;
  return false;
}

export function isLastCheckClawback(row: {
  kind: ClientEventKind;
  clawbackApplied: boolean;
}): boolean {
  if (row.clawbackApplied) return true;
  return CLAWBACK_KINDS.has(row.kind);
}

/**
 * Last-check pay rule (not the regular period classifier).
 * Cohort: 1st payment cleared in that upcoming period.
 * Monthly: 2 payments and a 2nd payment cleared date.
 * Bi-weekly / semi-monthly: 4 payments.
 */
export function passedLastCheckThreshold(row: {
  periodLabel: string;
  firstPaymentClearedDate: string | null | undefined;
  secondPaymentClearedDate: string | null | undefined;
  payFreq: string | null | undefined;
  paymentsMade: number;
  clawbackApplied?: boolean;
  kind?: ClientEventKind;
}): boolean {
  if (row.clawbackApplied) return false;
  if (row.kind && SKIP_PAY_KINDS.has(row.kind)) return false;
  const firstPeriod = periodOf(parseDate((row.firstPaymentClearedDate || "").trim()));
  if (!firstPeriod || firstPeriod !== row.periodLabel) return false;
  if (!lastCheckPaymentsVsThreshold(row.paymentsMade, row.payFreq).passed) return false;
  if (isMonthlyPayFreq(row.payFreq)) {
    return Boolean((row.secondPaymentClearedDate || "").trim());
  }
  return true;
}

export function lastCheckSecondClearLabel(
  secondPaymentClearedDate: string | null | undefined,
): string {
  const date = (secondPaymentClearedDate || "").trim();
  return date || "—";
}

export function commissionOnFile(enrolledDebt: number, tierRate: number): number {
  if (!Number.isFinite(enrolledDebt) || !Number.isFinite(tierRate) || enrolledDebt <= 0) {
    return 0;
  }
  return Math.round(enrolledDebt * tierRate * 100) / 100;
}

export function lastCheckCommission(opts: {
  agentName: string;
  unitsCleared: number;
  totalClearedDebt: number;
  cancellationRatePct: number;
}): AgentCommissionResult | null {
  if (opts.unitsCleared < 1 || opts.totalClearedDebt <= 0) return null;
  return calculateAgentCommission({
    agentName: opts.agentName,
    unitsCleared: opts.unitsCleared,
    totalClearedDebt: opts.totalClearedDebt,
    cancellationRatePct: opts.cancellationRatePct,
  });
}

export function lastCheckGustoAmount(opts: {
  grossCommission: number;
  clawbackAmount: number;
  manualBonusAmount?: number;
  advancePaidAmount?: number;
  advanceRepayAmount?: number;
  teamLeadBonusAmount?: number;
}): number {
  return computeNetCommission(
    opts.grossCommission,
    opts.clawbackAmount,
    opts.manualBonusAmount ?? 0,
    opts.advancePaidAmount ?? 0,
    opts.advanceRepayAmount ?? 0,
    opts.teamLeadBonusAmount ?? 0,
  );
}

export function lastCheckTierLabel(opts: {
  agentName: string;
  unitsCleared: number;
  result: AgentCommissionResult | null;
}): string {
  if (getFixedRate(opts.agentName) != null) return "Fixed rate";
  if (!opts.result || opts.unitsCleared < 1) return "—";
  return `Tier ${opts.result.adjustedTier}`;
}
