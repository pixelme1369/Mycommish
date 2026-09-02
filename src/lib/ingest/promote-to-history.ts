/**
 * Promote a calculated month into PeriodSource.history (Log as paid).
 * Copies exact per-file commissionOnClient / clawback amounts + paidRate
 * without mutating the calculated period.
 */

import { prisma } from "@/lib/db";
import {
  ClientEventKind,
  LedgerType,
  PeriodSource,
  PeriodStatus,
  Prisma,
  UploadType,
} from "@/generated/prisma/client";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { listOpenerAliasKeys } from "@/lib/agents/opener";
import { listExcludedKeysForPeriod } from "@/lib/agents/period-exclusion";
import { agentIdentityKey } from "@/lib/commission/calculator";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

function num(n: unknown) {
  return Number(n) || 0;
}

/** Same paid-row rules as commission-history export. */
export function isPromotePaidRow(kind: ClientEventKind, isCleared: boolean) {
  if (kind === ClientEventKind.cleared) return true;
  if (kind === ClientEventKind.low_credit_cleared) return true;
  if (kind === ClientEventKind.safe_cancel) return true;
  if (kind === ClientEventKind.history_paid) return true;
  if (isCleared && kind !== ClientEventKind.same_month_cancel) return true;
  return false;
}

/** Same clawback-row rules as commission-history export. */
export function isPromoteClawbackRow(kind: ClientEventKind, clawbackApplied: boolean) {
  return (
    clawbackApplied ||
    kind === ClientEventKind.clawback ||
    kind === ClientEventKind.cordoba_clawback ||
    kind === ClientEventKind.history_subtract
  );
}

export type PromoteToHistoryResult =
  | {
      ok: true;
      historyPeriodId: string;
      periodLabel: string;
      paidFileCount: number;
      clawbackFileCount: number;
      agentCount: number;
      uploadBatchId: string;
    }
  | { ok: false; error: string };

export async function promoteCalculatedPeriodToHistory(
  periodId: string,
  opts?: { uploadedById?: string },
): Promise<PromoteToHistoryResult> {
  const source = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!source) {
    return { ok: false, error: "Calculated period not found." };
  }

  const existingHistory = await prisma.commissionPeriod.findFirst({
    where: { periodLabel: source.periodLabel, source: PeriodSource.history },
  });
  if (existingHistory) {
    return {
      ok: false,
      error: `History for ${source.periodLabel} already exists — delete it to re-log.`,
    };
  }

  const agentPeriodsAll = await prisma.agentPeriod.findMany({
    where: { periodId },
    orderBy: { agentName: "asc" },
  });
  if (!agentPeriodsAll.length) {
    return { ok: false, error: "No agent rows to promote." };
  }

  // Match pay dashboard / Gusto: skip dismissed + period-excluded agents.
  const [dismissedKeys, openerKeys, excludedKeys] = await Promise.all([
    listDismissedKeys(),
    listOpenerAliasKeys(),
    listExcludedKeysForPeriod(source.periodLabel),
  ]);
  const agentPeriods = agentPeriodsAll.filter((ap) => {
    const key = agentIdentityKey(ap.agentName);
    return !dismissedKeys.has(key) && !openerKeys.has(key) && !excludedKeys.has(key);
  });
  if (!agentPeriods.length) {
    return {
      ok: false,
      error: "No active (non-dismissed / non-excluded) agent rows to promote.",
    };
  }

  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId: { in: agentPeriods.map((a) => a.id) } },
    orderBy: [{ agentName: "asc" }, { crmId: "asc" }],
  });

  type PaidFile = {
    crmId: string;
    clientName: string | null;
    paymentsMade: number;
    enrolledDebt: number;
    creditScore: number | null;
    isLowCredit: boolean;
    commissionOnClient: number;
    paidRate: number;
    payFreq: string | null;
    enrolledDate: string | null;
    firstPaymentClearedDate: string | null;
    secondPaymentClearedDate: string | null;
    droppedDate: string | null;
  };
  type ClawFile = {
    crmId: string;
    clientName: string | null;
    paymentsMade: number;
    enrolledDebt: number;
    clawbackAmount: number;
  };

  type AgentBucket = {
    source: (typeof agentPeriods)[0];
    paid: PaidFile[];
    claws: ClawFile[];
  };

  const byApId = new Map<string, AgentBucket>();
  for (const ap of agentPeriods) {
    byApId.set(ap.id, { source: ap, paid: [], claws: [] });
  }

  for (const e of events) {
    if (!e.agentPeriodId) continue;
    const bucket = byApId.get(e.agentPeriodId);
    if (!bucket) continue;
    const claw = isPromoteClawbackRow(e.kind, e.clawbackApplied);
    const paid = isPromotePaidRow(e.kind, e.isCleared);
    if (!claw && !paid) continue;
    if (!e.crmId) continue;

    if (claw) {
      const amt = Math.abs(num(e.clawbackAmount));
      if (amt <= 0) continue;
      bucket.claws.push({
        crmId: e.crmId,
        clientName: e.clientName,
        paymentsMade: e.paymentsMade,
        enrolledDebt: num(e.enrolledDebt),
        clawbackAmount: amt,
      });
      continue;
    }

    const tierRate = num(bucket.source.tierRate);
    const existingPaidRate = e.paidRate != null ? num(e.paidRate) : null;
    bucket.paid.push({
      crmId: e.crmId,
      clientName: e.clientName,
      paymentsMade: e.paymentsMade,
      enrolledDebt: num(e.enrolledDebt),
      creditScore: e.creditScore,
      isLowCredit: e.isLowCredit,
      commissionOnClient: Math.round(num(e.commissionOnClient) * 100) / 100,
      paidRate:
        existingPaidRate != null && existingPaidRate > 0 ? existingPaidRate : tierRate,
      payFreq: e.payFreq,
      enrolledDate: e.enrolledDate,
      firstPaymentClearedDate: e.firstPaymentClearedDate,
      secondPaymentClearedDate: e.secondPaymentClearedDate,
      droppedDate: e.droppedDate,
    });
  }

  const activeBuckets = [...byApId.values()].filter(
    (b) => b.paid.length > 0 || b.claws.length > 0,
  );
  if (!activeBuckets.length) {
    return {
      ok: false,
      error: "No paid or clawback client files to log for this period.",
    };
  }

  const filename = `promoted-from-calculated-${source.periodLabel}`;
  const batch = await prisma.uploadBatch.create({
    data: {
      type: UploadType.history,
      filename,
      uploadedById: opts?.uploadedById || null,
    },
  });

  const periodRow = await prisma.commissionPeriod.create({
    data: {
      periodLabel: source.periodLabel,
      source: PeriodSource.history,
      status: PeriodStatus.closed,
      filename,
      closedAt: new Date(),
    },
  });

  const identityMap = new Map<
    string,
    {
      crmId: string;
      clientName: string | null;
      enrolledDebt: number | null;
      creditScore: number | null;
    }
  >();
  for (const b of activeBuckets) {
    for (const c of b.paid) {
      if (identityMap.has(c.crmId)) continue;
      identityMap.set(c.crmId, {
        crmId: c.crmId,
        clientName: c.clientName,
        enrolledDebt: c.enrolledDebt,
        creditScore: c.creditScore,
      });
    }
    for (const c of b.claws) {
      if (identityMap.has(c.crmId)) continue;
      identityMap.set(c.crmId, {
        crmId: c.crmId,
        clientName: c.clientName,
        enrolledDebt: c.enrolledDebt,
        creditScore: null,
      });
    }
  }
  if (identityMap.size) {
    await prisma.clientIdentity.createMany({
      data: [...identityMap.values()].map((c) => ({
        crmId: c.crmId,
        clientName: c.clientName,
        enrolledDebt: c.enrolledDebt != null ? dec(c.enrolledDebt) : null,
        creditScore: c.creditScore,
      })),
      skipDuplicates: true,
    });
  }

  const eventRows: Prisma.ClientEventCreateManyInput[] = [];
  const ledgerRows: Prisma.LedgerEntryCreateManyInput[] = [];
  let paidFileCount = 0;
  let clawbackFileCount = 0;

  for (const b of activeBuckets) {
    const unitsCleared = b.paid.length;
    const totalClearedDebt =
      Math.round(
        b.paid.filter((c) => !c.isLowCredit).reduce((s, c) => s + c.enrolledDebt, 0) * 100,
      ) / 100;
    const grossCommission =
      Math.round(b.paid.reduce((s, c) => s + c.commissionOnClient, 0) * 100) / 100;
    const clawbackAmount =
      Math.round(b.claws.reduce((s, c) => s + c.clawbackAmount, 0) * 100) / 100;
    const netCommission = Math.max(
      0,
      Math.round((grossCommission - clawbackAmount) * 100) / 100,
    );
    const tierRate = num(b.source.tierRate);

    const agentPeriod = await prisma.agentPeriod.create({
      data: {
        periodId: periodRow.id,
        agentName: b.source.agentName,
        unitsCleared,
        totalClearedDebt: dec(totalClearedDebt),
        cancellationRate: b.source.cancellationRate,
        rawTier: b.source.rawTier,
        adjustedTier: b.source.adjustedTier,
        tierRate: dec(tierRate),
        grossCommission: dec(grossCommission),
        clawbackAmount: dec(clawbackAmount),
        netCommission: dec(netCommission),
        payout: dec(netCommission),
        payoutType: b.source.payoutType,
        qualityBonusEligible: b.source.qualityBonusEligible,
        cancellationPenaltyApplied: b.source.cancellationPenaltyApplied,
        nsfFlagged: b.source.nsfFlagged,
        pendingUnits: 0,
        pendingDebt: dec(0),
        notes: `Logged as paid from calculated ${source.periodLabel}`,
      },
    });

    if (grossCommission > 0) {
      ledgerRows.push({
        type: LedgerType.commission_credit,
        amount: dec(grossCommission),
        agentName: b.source.agentName,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "history_period_gross",
        note: "promoted_from_calculated",
        uploadBatchId: batch.id,
      });
    }

    for (const c of b.paid) {
      paidFileCount += 1;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: b.source.agentName,
        kind: ClientEventKind.history_paid,
        clientName: c.clientName,
        enrolledDate: c.enrolledDate,
        firstPaymentClearedDate: c.firstPaymentClearedDate,
        secondPaymentClearedDate: c.secondPaymentClearedDate,
        droppedDate: c.droppedDate,
        payFreq: c.payFreq,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        creditScore: c.creditScore,
        isLowCredit: c.isLowCredit,
        isCleared: true,
        clawbackApplied: false,
        commissionOnClient: dec(c.commissionOnClient),
        paidRate: c.paidRate > 0 ? dec(c.paidRate) : null,
        uploadBatchId: batch.id,
      });
    }

    for (const c of b.claws) {
      clawbackFileCount += 1;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: b.source.agentName,
        kind: ClientEventKind.history_subtract,
        clientName: c.clientName,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        isCleared: false,
        clawbackApplied: true,
        clawbackAmount: dec(c.clawbackAmount),
        commissionOnClient: dec(0),
        uploadBatchId: batch.id,
      });
      ledgerRows.push({
        type: LedgerType.clawback_history,
        amount: dec(c.clawbackAmount),
        crmId: c.crmId,
        agentName: b.source.agentName,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "history_to_subtract",
        note: c.clientName || c.crmId,
        uploadBatchId: batch.id,
      });
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < eventRows.length; i += CHUNK) {
    await prisma.clientEvent.createMany({ data: eventRows.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < ledgerRows.length; i += CHUNK) {
    await prisma.ledgerEntry.createMany({ data: ledgerRows.slice(i, i + CHUNK) });
  }

  const summary = {
    promotedFromPeriodId: source.id,
    periodLabel: source.periodLabel,
    historyPeriodId: periodRow.id,
    paidFileCount,
    clawbackFileCount,
    agentCount: activeBuckets.length,
  };
  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { summaryJson: summary as object },
  });

  return {
    ok: true,
    historyPeriodId: periodRow.id,
    periodLabel: source.periodLabel,
    paidFileCount,
    clawbackFileCount,
    agentCount: activeBuckets.length,
    uploadBatchId: batch.id,
  };
}
