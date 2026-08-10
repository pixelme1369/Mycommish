/**
 * Persist commission-history ledger into PeriodSource.history.
 * Never blocks or overwrites calculated periods for the same month.
 */

import { prisma } from "@/lib/db";
import { parseCommissionHistory } from "@/lib/commission/commission-history-parser";
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
};

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
  };

  for (const period of parsed.periods) {
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

  // Identities first
  const identities = new Map<
    string,
    { crmId: string; clientName?: string; enrolledDebt?: number }
  >();
  for (const r of results) {
    for (const c of [...r._clearedClients, ...r._clawbackClients]) {
      if (!c.crmId || identities.has(c.crmId)) continue;
      identities.set(c.crmId, {
        crmId: c.crmId,
        clientName: c.clientName,
        enrolledDebt: c.enrolledDebt,
      });
    }
  }
  if (identities.size) {
    await prisma.clientIdentity.createMany({
      data: [...identities.values()].map((c) => ({
        crmId: c.crmId,
        clientName: c.clientName || null,
        enrolledDebt: c.enrolledDebt != null ? dec(c.enrolledDebt) : null,
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
      const commissionOnClient =
        Math.round(c.enrolledDebt * r.tierRate * 100) / 100;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: ClientEventKind.history_paid,
        clientName: c.clientName || null,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        isCleared: true,
        clawbackApplied: false,
        commissionOnClient: dec(commissionOnClient),
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
