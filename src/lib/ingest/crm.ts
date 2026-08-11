/**
 * Persist CRM parse results into the ledger-backed schema.
 * Lock-after-pay: closed calculated periods refuse new unit/gross rewrites;
 * clawbacks may still land (owner policy).
 */

import { prisma } from "@/lib/db";
import { isPeriodClosedByPayday } from "@/lib/commission/calculator";
import type { CrmClient, PeriodOutput } from "@/lib/commission/crm-parser";
import { isPoisonedDebtDroppedDate, parseCrmAndCalculate } from "@/lib/commission/crm-parser";
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

function eventKind(unitStatus: string, clawbackApplied: boolean): ClientEventKind {
  if (clawbackApplied) return ClientEventKind.clawback;
  switch (unitStatus) {
    case "cleared":
      return ClientEventKind.cleared;
    case "pending":
      return ClientEventKind.pending;
    case "safe_cancel":
      return ClientEventKind.safe_cancel;
    case "same_month_cancel":
      return ClientEventKind.same_month_cancel;
    case "clawback":
      return ClientEventKind.clawback;
    default:
      return ClientEventKind.cleared;
  }
}

export type SaveCrmSummary = {
  uploadBatchId: string;
  periodsCreated: string[];
  periodsUpdatedClawbacks: string[];
  periodsSkippedClosed: string[];
  periodsSkippedExistingOpen: string[];
  errors: string[];
};

export async function loadCrmContextFromDb() {
  const cleared = await prisma.clientEvent.findMany({
    where: { isCleared: true },
    select: {
      crmId: true,
      enrolledDebt: true,
      paidRate: true,
      isLowCredit: true,
      droppedDate: true,
    },
  });
  const clawed = await prisma.clientEvent.findMany({
    where: { clawbackApplied: true },
    select: { crmId: true },
  });
  const historyPaid = await prisma.clientEvent.findMany({
    where: { kind: ClientEventKind.history_paid, isCleared: true },
    select: { crmId: true },
  });
  const agentPeriods = await prisma.agentPeriod.findMany({
    include: { period: true },
  });

  const alreadyClearedCrmIds = new Set(cleared.map((c) => c.crmId).filter(Boolean));
  const alreadyChargedBackCrmIds = new Set(clawed.map((c) => c.crmId).filter(Boolean));
  const alreadyLowCreditCrmIds = new Set(
    cleared.filter((c) => c.isLowCredit).map((c) => c.crmId).filter(Boolean),
  );
  const alreadyHistoryPaidCrmIds = new Set(historyPaid.map((c) => c.crmId).filter(Boolean));

  const knownEnrolledDebtByCrmId: Record<string, number> = {};
  const knownRateByCrmId: Record<string, number> = {};
  for (const c of cleared) {
    if (!c.crmId) continue;
    // Skip clears whose Dropped Date is a leftover currency fragment from a bad CSV split.
    if (isPoisonedDebtDroppedDate(c.droppedDate)) continue;
    const debt = Number(c.enrolledDebt);
    if (!(debt > 0)) continue;
    // Keep the largest known debt (History / corrected CRM wins over truncated).
    const prev = knownEnrolledDebtByCrmId[c.crmId];
    if (prev == null || debt > prev) knownEnrolledDebtByCrmId[c.crmId] = debt;
    if (c.paidRate != null) knownRateByCrmId[c.crmId] = Number(c.paidRate);
  }

  const knownPeriodTotals: Record<
    string,
    { unitsCleared: number; totalClearedDebt: number; grossCommission: number; cancellationRate: number }
  > = {};
  for (const ap of agentPeriods) {
    const key = `${ap.agentName.trim().toLowerCase()}::${ap.period.periodLabel}`;
    const prev = knownPeriodTotals[key] ?? {
      unitsCleared: 0,
      totalClearedDebt: 0,
      grossCommission: 0,
      cancellationRate: 0,
    };
    knownPeriodTotals[key] = {
      unitsCleared: prev.unitsCleared + ap.unitsCleared,
      totalClearedDebt: prev.totalClearedDebt + Number(ap.totalClearedDebt),
      grossCommission: prev.grossCommission + Number(ap.grossCommission),
      // last-write cancel rate is imperfect when summing sources; prefer calculated if present
      cancellationRate: Number(ap.cancellationRate) || prev.cancellationRate,
    };
  }

  return {
    alreadyClearedCrmIds,
    alreadyChargedBackCrmIds,
    alreadyLowCreditCrmIds,
    alreadyHistoryPaidCrmIds,
    knownEnrolledDebtByCrmId,
    knownRateByCrmId,
    knownPeriodTotals,
  };
}

export async function ingestCrmUpload(
  fileBytes: Uint8Array | Buffer | string,
  filename: string,
  uploadedById?: string,
): Promise<SaveCrmSummary> {
  const ctx = await loadCrmContextFromDb();
  const periods = parseCrmAndCalculate(fileBytes, filename, {
    ...ctx,
    persistSameMonthCancel: true,
    requirePriorPaymentEvidence: false,
    requireClawbackPaymentEvidence: true,
  });

  return saveCrmPeriodResults(periods, filename, uploadedById);
}

export async function saveCrmPeriodResults(
  periods: PeriodOutput[],
  filename: string,
  uploadedById?: string,
): Promise<SaveCrmSummary> {
  const summary: SaveCrmSummary = {
    uploadBatchId: "",
    periodsCreated: [],
    periodsUpdatedClawbacks: [],
    periodsSkippedClosed: [],
    periodsSkippedExistingOpen: [],
    errors: [],
  };

  for (const p of periods) {
    if (p.errors?.length) summary.errors.push(...p.errors);
  }

  const batch = await prisma.uploadBatch.create({
    data: {
      type: UploadType.crm,
      filename,
      uploadedById: uploadedById ?? null,
      summaryJson: {},
    },
  });
  summary.uploadBatchId = batch.id;

  // Upsert full CRM directory (External ID + Sales Rep) even for not-yet-cleared files.
  // Batched — full exports are large; per-row upserts were taking minutes.
  await upsertDirectoryIdentities(periods[0]?.directoryClients ?? []);

  for (const period of periods) {
    if (!period.periodLabel) continue;

    const existing = await prisma.commissionPeriod.findUnique({
      where: {
        periodLabel_source: {
          periodLabel: period.periodLabel,
          source: PeriodSource.calculated,
        },
      },
      include: { agentPeriods: true },
    });

    const closedByPayday = isPeriodClosedByPayday(period.periodLabel);
    const isClosed = existing?.status === PeriodStatus.closed || closedByPayday;

    const hasNewUnits = period.results.some((r) => r.unitsCleared > 0);
    const hasClawbacks = period.results.some((r) => (r.clawbackAmount || 0) > 0);

    if (existing && isClosed) {
      if (hasNewUnits) summary.periodsSkippedClosed.push(period.periodLabel);
      if (hasClawbacks) {
        await applyClawbacksOnly(existing.id, period, batch.id);
        summary.periodsUpdatedClawbacks.push(period.periodLabel);
      }
      continue;
    }

    if (existing && !isClosed && hasNewUnits) {
      // Open period already exists: skip re-import of units (delete first to redo).
      // Still apply new clawbacks.
      summary.periodsSkippedExistingOpen.push(period.periodLabel);
      if (hasClawbacks) {
        await applyClawbacksOnly(existing.id, period, batch.id);
        summary.periodsUpdatedClawbacks.push(period.periodLabel);
      }
      continue;
    }

    if (!existing) {
      await createFullPeriod(period, batch.id, closedByPayday ? PeriodStatus.closed : PeriodStatus.open);
      summary.periodsCreated.push(period.periodLabel);
    } else if (!hasNewUnits && hasClawbacks) {
      await applyClawbacksOnly(existing.id, period, batch.id);
      summary.periodsUpdatedClawbacks.push(period.periodLabel);
    }
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { summaryJson: summary as object },
  });

  return summary;
}

async function createFullPeriod(
  period: PeriodOutput,
  uploadBatchId: string,
  status: PeriodStatus,
) {
  const periodRow = await prisma.commissionPeriod.create({
    data: {
      periodLabel: period.periodLabel!,
      source: PeriodSource.calculated,
      status,
      filename: period.filename,
      closedAt: status === PeriodStatus.closed ? new Date() : null,
    },
  });

  // Batch identities (one round-trip) before events reference them.
  // Directory upsert above usually already wrote these; skipDuplicates covers races.
  const identityMap = new Map<string, CrmClient>();
  for (const r of period.results) {
    for (const c of [
      ...(r._clearedClients ?? []),
      ...(r._allPeriodClients ?? []),
      ...(r._clawbackClients ?? []),
    ]) {
      if (!c.crmId || identityMap.has(c.crmId)) continue;
      identityMap.set(c.crmId, c);
    }
  }
  if (identityMap.size) {
    await prisma.clientIdentity.createMany({
      data: [...identityMap.values()].map((c) => ({
        crmId: c.crmId,
        externalId: c.externalId?.trim() || null,
        salesRep: c.agentName ?? null,
        clientName: c.clientName ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        enrolledDebt: c.enrolledDebt != null ? dec(c.enrolledDebt) : null,
        creditScore: c.creditScore ?? null,
        payFreq: c.payFreq ?? null,
        crmStatus: c.status ?? null,
        enrolledDate: c.enrolledDate || null,
        firstPaymentClearedDate: c.firstPaymentClearedDate || null,
        droppedDate: c.droppedDate || null,
      })),
      skipDuplicates: true,
    });
  }

  const eventRows: Prisma.ClientEventCreateManyInput[] = [];
  const ledgerRows: Prisma.LedgerEntryCreateManyInput[] = [];

  for (const r of period.results) {
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
        payout: dec(r.payout),
        payoutType: r.payoutType,
        qualityBonusEligible: r.qualityBonusEligible,
        cancellationPenaltyApplied: r.cancellationPenaltyApplied,
        nsfFlagged: r.nsfFlagged,
        pendingUnits: r.pendingUnits,
        pendingDebt: dec(r.pendingDebt),
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
        reasonCode: "crm_period_gross",
        uploadBatchId,
      });
    }

    const clearedClients = r._clearedClients ?? [];
    const clearedSet = new Set(clearedClients);

    for (const c of clearedClients) {
      if (!c.crmId) continue;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: c.isLowCredit ? ClientEventKind.low_credit_cleared : eventKind(c.unitStatus, false),
        clientName: c.clientName,
        enrolledDate: c.enrolledDate,
        firstPaymentClearedDate: c.firstPaymentClearedDate,
        droppedDate: c.droppedDate || null,
        payFreq: c.payFreq,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        creditScore: c.creditScore,
        isLowCredit: c.isLowCredit,
        isCleared: c.unitStatus === "cleared",
        clawbackApplied: false,
        commissionOnClient: dec(c.commissionOnClient),
        isLateActivation: Boolean(c.isLateActivation),
        originalClearedPeriod: c.originalClearedPeriod ?? null,
        uploadBatchId,
      });
    }

    for (const c of r._allPeriodClients ?? []) {
      if (!c.crmId) continue;
      if (clearedSet.has(c)) continue;
      if (c.unitStatus === "clawback") continue;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: eventKind(c.unitStatus, false),
        clientName: c.clientName,
        enrolledDate: c.enrolledDate,
        firstPaymentClearedDate: c.firstPaymentClearedDate,
        droppedDate: c.droppedDate || null,
        payFreq: c.payFreq,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        creditScore: c.creditScore,
        isLowCredit: c.isLowCredit,
        isCleared: false,
        clawbackApplied: false,
        commissionOnClient: dec(c.commissionOnClient || 0),
        uploadBatchId,
      });
    }

    for (const c of r._clawbackClients ?? []) {
      if (!c.crmId || c.clawbackAmount <= 0) continue;
      eventRows.push({
        crmId: c.crmId,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        agentName: r.agentName,
        kind: ClientEventKind.clawback,
        clientName: c.clientName,
        enrolledDate: c.enrolledDate,
        firstPaymentClearedDate: c.firstPaymentClearedDate,
        droppedDate: c.droppedDate || null,
        payFreq: c.payFreq,
        paymentsMade: c.paymentsMade,
        enrolledDebt: dec(c.enrolledDebt),
        creditScore: c.creditScore,
        isLowCredit: c.isLowCredit,
        isCleared: false,
        clawbackApplied: true,
        clawbackAmount: dec(c.clawbackAmount),
        commissionOnClient: dec(0),
        uploadBatchId,
      });
      ledgerRows.push({
        type: LedgerType.clawback_crm,
        amount: dec(c.clawbackAmount),
        crmId: c.crmId,
        agentName: r.agentName,
        periodId: periodRow.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "crm_clawback",
        note: c.clientName || c.crmId,
        uploadBatchId,
      });
    }
  }

  // Chunk large createMany calls — Neon/pg has parameter limits.
  const CHUNK = 500;
  for (let i = 0; i < eventRows.length; i += CHUNK) {
    await prisma.clientEvent.createMany({ data: eventRows.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < ledgerRows.length; i += CHUNK) {
    await prisma.ledgerEntry.createMany({ data: ledgerRows.slice(i, i + CHUNK) });
  }
}

async function applyClawbacksOnly(
  periodId: string,
  period: PeriodOutput,
  uploadBatchId: string,
) {
  for (const r of period.results) {
    const cbClients = r._clawbackClients ?? [];
    if (!cbClients.length) continue;

    let agentPeriod = await prisma.agentPeriod.findUnique({
      where: { periodId_agentName: { periodId, agentName: r.agentName } },
    });
    if (!agentPeriod) {
      agentPeriod = await prisma.agentPeriod.create({
        data: {
          periodId,
          agentName: r.agentName,
          unitsCleared: 0,
          totalClearedDebt: dec(0),
          cancellationRate: dec(0),
          rawTier: 0,
          adjustedTier: 0,
          tierRate: dec(0),
          grossCommission: dec(0),
          clawbackAmount: dec(0),
          netCommission: dec(0),
          payout: dec(0),
          payoutType: "none",
        },
      });
    }

    let added = 0;
    for (const c of cbClients) {
      if (!c.crmId || c.clawbackAmount <= 0) continue;
      const already = await prisma.clientEvent.findFirst({
        where: { crmId: c.crmId, clawbackApplied: true },
      });
      if (already) continue;

      await upsertDirectoryIdentities([c]);
      await prisma.clientEvent.create({
        data: {
          crmId: c.crmId,
          periodId,
          agentPeriodId: agentPeriod.id,
          agentName: r.agentName,
          kind: ClientEventKind.clawback,
          clientName: c.clientName,
          enrolledDate: c.enrolledDate,
          firstPaymentClearedDate: c.firstPaymentClearedDate,
          droppedDate: c.droppedDate || null,
          payFreq: c.payFreq,
          paymentsMade: c.paymentsMade,
          enrolledDebt: dec(c.enrolledDebt),
          isCleared: false,
          clawbackApplied: true,
          clawbackAmount: dec(c.clawbackAmount),
          uploadBatchId,
        },
      });
      await prisma.ledgerEntry.create({
        data: {
          type: LedgerType.clawback_crm,
          amount: dec(c.clawbackAmount),
          crmId: c.crmId,
          agentName: r.agentName,
          periodId,
          agentPeriodId: agentPeriod.id,
          reasonCode: "crm_clawback",
          note: c.clientName || c.crmId,
          uploadBatchId,
        },
      });
      added += c.clawbackAmount;
    }

    if (added > 0) {
      const newCb = Number(agentPeriod.clawbackAmount) + added;
      const gross = Number(agentPeriod.grossCommission);
      await prisma.agentPeriod.update({
        where: { id: agentPeriod.id },
        data: {
          clawbackAmount: dec(Math.round(newCb * 100) / 100),
          netCommission: dec(Math.max(0, Math.round((gross - newCb) * 100) / 100)),
          notes: agentPeriod.notes
            ? `${agentPeriod.notes} | CRM clawback +$${added.toFixed(2)}`
            : `CRM clawback +$${added.toFixed(2)}`,
        },
      });
    }
  }
}

async function upsertDirectoryIdentities(clients: CrmClient[]) {
  const byId = new Map<string, CrmClient>();
  for (const c of clients) {
    if (!c.crmId || byId.has(c.crmId)) continue;
    byId.set(c.crmId, c);
  }
  const rows = [...byId.values()];
  if (!rows.length) return;

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(
      (c) => Prisma.sql`(
        ${c.crmId},
        ${c.externalId?.trim() || null},
        ${c.agentName?.trim() || null},
        ${c.clientName || null},
        ${c.email || null},
        ${c.phone || null},
        ${c.enrolledDebt != null ? dec(c.enrolledDebt) : null},
        ${c.creditScore},
        ${c.payFreq || null},
        ${c.status || null},
        ${c.enrolledDate || null},
        ${c.firstPaymentClearedDate || null},
        ${c.droppedDate || null},
        NOW()
      )`,
    );

    await prisma.$executeRaw`
      INSERT INTO "ClientIdentity" (
        "crmId",
        "externalId",
        "salesRep",
        "clientName",
        "email",
        "phone",
        "enrolledDebt",
        "creditScore",
        "payFreq",
        "crmStatus",
        "enrolledDate",
        "firstPaymentClearedDate",
        "droppedDate",
        "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("crmId") DO UPDATE SET
        "externalId" = COALESCE(EXCLUDED."externalId", "ClientIdentity"."externalId"),
        "salesRep" = COALESCE(EXCLUDED."salesRep", "ClientIdentity"."salesRep"),
        "clientName" = COALESCE(EXCLUDED."clientName", "ClientIdentity"."clientName"),
        "email" = COALESCE(EXCLUDED."email", "ClientIdentity"."email"),
        "phone" = COALESCE(EXCLUDED."phone", "ClientIdentity"."phone"),
        "enrolledDebt" = COALESCE(EXCLUDED."enrolledDebt", "ClientIdentity"."enrolledDebt"),
        "creditScore" = COALESCE(EXCLUDED."creditScore", "ClientIdentity"."creditScore"),
        "payFreq" = COALESCE(EXCLUDED."payFreq", "ClientIdentity"."payFreq"),
        "crmStatus" = COALESCE(EXCLUDED."crmStatus", "ClientIdentity"."crmStatus"),
        "enrolledDate" = COALESCE(EXCLUDED."enrolledDate", "ClientIdentity"."enrolledDate"),
        "firstPaymentClearedDate" = COALESCE(EXCLUDED."firstPaymentClearedDate", "ClientIdentity"."firstPaymentClearedDate"),
        "droppedDate" = COALESCE(EXCLUDED."droppedDate", "ClientIdentity"."droppedDate"),
        "updatedAt" = NOW()
    `;
  }
}
