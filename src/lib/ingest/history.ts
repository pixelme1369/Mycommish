/**
 * Persist commission-history ledger into PeriodSource.history.
 * Never blocks or overwrites calculated periods for the same month.
 */

import { prisma } from "@/lib/db";
import {
  applyCrmCreditScoresToHistoryResults,
  parseCommissionHistory,
} from "@/lib/commission/commission-history-parser";
import {
  ClientEventKind,
  LedgerType,
  PeriodSource,
  PeriodStatus,
  Prisma,
  UploadType,
} from "@/generated/prisma/client";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export type SaveHistorySummary = {
  uploadBatchId: string;
  periodsCreated: string[];
  periodsSkipped: string[];
  errors: string[];
  lowCreditZeroPayCount?: number;
  missingCreditScoreCount?: number;
};

/** Prefer ClientIdentity.creditScore; fall back to any prior event with a score. */
async function loadCreditScoresByCrmId(crmIds: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  if (!crmIds.length) return out;

  const identities = await prisma.clientIdentity.findMany({
    where: { crmId: { in: crmIds } },
    select: { crmId: true, creditScore: true },
  });
  for (const id of identities) {
    out[id.crmId] = id.creditScore;
  }

  const missing = crmIds.filter((id) => out[id] == null);
  if (missing.length) {
    const events = await prisma.clientEvent.findMany({
      where: { crmId: { in: missing }, creditScore: { not: null } },
      select: { crmId: true, creditScore: true },
    });
    for (const e of events) {
      if (out[e.crmId] == null && e.creditScore != null) {
        out[e.crmId] = e.creditScore;
      }
    }
  }

  return out;
}

export async function ingestHistoryUpload(
  fileBytes: Uint8Array | Buffer | ArrayBuffer,
  filename: string,
  year: number,
  uploadedById?: string,
): Promise<SaveHistorySummary> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Year must be a valid calendar year (e.g. 2025).");
  }

  const parsed = await parseCommissionHistory(fileBytes, filename, year);

  const allClearedIds = [
    ...new Set(
      parsed.periods.flatMap((p) =>
        p.results.flatMap((r) => r._clearedClients.map((c) => c.crmId).filter(Boolean)),
      ),
    ),
  ];
  const creditScoreByCrmId = await loadCreditScoresByCrmId(allClearedIds);

  let lowCreditZeroPayCount = 0;
  let missingCreditScoreCount = 0;
  let sheetCommissionCount = 0;
  const periodsWithScores = parsed.periods.map((p) => {
    const applied = applyCrmCreditScoresToHistoryResults(p.results, creditScoreByCrmId);
    lowCreditZeroPayCount += applied.lowCreditCount;
    missingCreditScoreCount += applied.missingScoreCount;
    sheetCommissionCount += applied.sheetCommissionCount;
    return { ...p, results: applied.results };
  });

  const batch = await prisma.uploadBatch.create({
    data: {
      type: UploadType.history,
      filename,
      uploadedById: uploadedById || null,
    },
  });

  const summary: SaveHistorySummary = {
    uploadBatchId: batch.id,
    periodsCreated: [],
    periodsSkipped: [],
    errors: [...parsed.errors],
    lowCreditZeroPayCount,
    missingCreditScoreCount,
  };

  if (sheetCommissionCount > 0) {
    summary.errors.push(
      `${sheetCommissionCount} history unit(s) used sheet Commission on Client as paid amount (not recalculated).`,
    );
  }
  if (lowCreditZeroPayCount > 0) {
    summary.errors.push(
      `${lowCreditZeroPayCount} history unit(s) matched CRM Credit Score ≤ 500 — counted as units at $0 commission when Commission on Client was blank (anti-double-pay still applied).`,
    );
  }
  if (missingCreditScoreCount > 0) {
    summary.errors.push(
      `${missingCreditScoreCount} history unit(s) had no CRM credit score and no Commission on Client — paid via debt × tier. Upload CRM first or fill Commission on Client.`,
    );
  }

  for (const period of periodsWithScores) {
    const existing = await prisma.commissionPeriod.findFirst({
      where: { periodLabel: period.periodLabel, source: PeriodSource.history },
    });
    if (existing) {
      summary.periodsSkipped.push(period.periodLabel);
      summary.errors.push(
        `Commission history for ${period.periodLabel} was already imported (from "${existing.filename}"). Delete that history period first to re-import.`,
      );
      continue;
    }

    await saveHistoryPeriod(period.periodLabel, period.results, filename, batch.id);
    summary.periodsCreated.push(period.periodLabel);
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { summaryJson: summary as object },
  });

  return summary;
}

async function saveHistoryPeriod(
  periodLabel: string,
  results: Awaited<ReturnType<typeof parseCommissionHistory>>["periods"][0]["results"],
  filename: string,
  uploadBatchId: string,
) {
  const periodRow = await prisma.commissionPeriod.create({
    data: {
      periodLabel,
      source: PeriodSource.history,
      status: PeriodStatus.closed,
      filename,
      closedAt: new Date(),
    },
  });

  // Identities first (carry CRM credit score when we resolved one for low-credit zeroing)
  const identities = new Map<
    string,
    {
      crmId: string;
      clientName?: string;
      enrolledDebt?: number;
      creditScore?: number | null;
    }
  >();
  for (const r of results) {
    for (const c of [...r._clearedClients, ...r._clawbackClients]) {
      if (!c.crmId || identities.has(c.crmId)) continue;
      identities.set(c.crmId, {
        crmId: c.crmId,
        clientName: c.clientName,
        enrolledDebt: c.enrolledDebt,
        creditScore: "creditScore" in c ? (c.creditScore ?? null) : null,
      });
    }
  }
  if (identities.size) {
    await prisma.clientIdentity.createMany({
      data: [...identities.values()].map((c) => ({
        crmId: c.crmId,
        clientName: c.clientName || null,
        enrolledDebt: c.enrolledDebt != null ? dec(c.enrolledDebt) : null,
        creditScore: c.creditScore ?? null,
      })),
      skipDuplicates: true,
    });
  }

  const eventRows: Prisma.ClientEventCreateManyInput[] = [];
  const ledgerRows: Prisma.LedgerEntryCreateManyInput[] = [];

  for (const r of results) {
    const agentPeriod = await prisma.agentPeriod.create({
      data: {
        periodId: periodRow.id,
        agentName: r.agentName,
        unitsCleared: r.unitsCleared,
        totalClearedDebt: dec(r.totalClearedDebt),
        cancellationRate: dec(r.cancellationRate),
        rawTier: r.rawTier,
        adjustedTier: r.adjustedTier,
        tierRate: dec(r.tierRate),
        grossCommission: dec(r.grossCommission),
        clawbackAmount: dec(r.clawbackAmount),
        netCommission: dec(r.netCommission),
        payout: dec(r.netCommission),
        payoutType: r.payoutType,
        qualityBonusEligible: r.qualityBonusEligible,
        cancellationPenaltyApplied: r.cancellationPenaltyApplied,
        nsfFlagged: r.nsfFlagged,
        pendingUnits: 0,
        pendingDebt: dec(0),
        notes: r.notes || null,
      },
    });

    if (r.grossCommission > 0) {
      ledgerRows.push({
        type: LedgerType.commission_credit,
        amount: dec(r.grossCommission),
        agentName: r.agentName,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "history_period_gross",
        uploadBatchId,
      });
    }

    for (const c of r._clearedClients) {
      if (!c.crmId) continue;
      const isLowCredit = Boolean(c.isLowCredit);
      const commissionOnClient =
        c.commissionOnClient != null
          ? c.commissionOnClient
          : isLowCredit
            ? 0
            : Math.round(c.enrolledDebt * r.tierRate * 100) / 100;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: ClientEventKind.history_paid,
        clientName: c.clientName || null,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        creditScore: c.creditScore ?? null,
        isLowCredit,
        isCleared: true,
        clawbackApplied: false,
        commissionOnClient: dec(commissionOnClient),
        // Low-credit: keep sheet Rate for audit; clawback path skips via isLowCredit.
        paidRate: c.paidRate != null ? dec(c.paidRate) : null,
        uploadBatchId,
      });
    }

    for (const c of r._clawbackClients) {
      if (!c.crmId || c.clawbackAmount <= 0) continue;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: ClientEventKind.history_subtract,
        clientName: c.clientName || null,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        isCleared: false,
        clawbackApplied: true,
        clawbackAmount: dec(c.clawbackAmount),
        commissionOnClient: dec(0),
        uploadBatchId,
      });
      ledgerRows.push({
        type: LedgerType.clawback_history,
        amount: dec(c.clawbackAmount),
        crmId: c.crmId,
        agentName: r.agentName,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "history_to_subtract",
        note: c.clientName || c.crmId,
        uploadBatchId,
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
}
