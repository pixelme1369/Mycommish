/**
 * Cordoba payout ingest — paid evidence + chargebacks onto calculated periods.
 *
 * ID mapping (owner): Cordoba file "ID" === ADP CRM "External ID" (what agents
 * search / claim). Ledger + ClientEvent keys use CRM "ID" (ClientIdentity.crmId).
 * Resolve Cordoba IDs via ClientIdentity.externalId before any FK write.
 *
 * Drop placement uses ANY ClientEvent with droppedDate for that crmId (never the file).
 */

import { prisma } from "@/lib/db";
import {
  calculateClawbackAmount,
  getFixedRate,
  isPeriodClosedByPayday,
} from "@/lib/commission/calculator";
import { parseCordobaPayout, type CordobaChargebackRow } from "@/lib/commission/cordoba-parser";
import { parseDate, periodOf } from "@/lib/commission/crm-parser";
import { clawbackAmountFromPaidRate } from "@/lib/portal/clawback-paid-rate-math";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";
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

function label(clientName: string | null | undefined, externalId: string) {
  return clientName ? `${clientName} (${externalId})` : externalId;
}

const CHUNK = 500;

export type SaveCordobaSummary = {
  uploadBatchId: string;
  paidNew: number;
  paidUnmatched: string[];
  chargebackSeenNew: number;
  chargebackUnmatched: string[];
  clawbacksApplied: number;
  clawbackTotal: number;
  snapshotsListed: number;
  snapshotsUpdated: number;
  skippedNotCommissioned: string[];
  skippedNotConfirmedPaid: string[];
  skippedAlreadyClawed: string[];
  skippedNoDroppedDate: string[];
  errors: string[];
};

/**
 * Map Cordoba ID (CRM External ID) → ClientIdentity.crmId (CRM ID).
 * Prefer externalId match; fall back to crmId for legacy rows keyed by Cordoba ID.
 */
async function resolveCordobaIdToCrmId(
  cordobaIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(cordobaIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (!ids.length) return map;

  const byExternal = await prisma.clientIdentity.findMany({
    where: { externalId: { in: ids } },
    select: { crmId: true, externalId: true },
  });
  for (const row of byExternal) {
    if (row.externalId) map.set(row.externalId, row.crmId);
  }

  const unresolved = ids.filter((id) => !map.has(id));
  if (unresolved.length) {
    const byCrm = await prisma.clientIdentity.findMany({
      where: { crmId: { in: unresolved } },
      select: { crmId: true },
    });
    for (const row of byCrm) {
      map.set(row.crmId, row.crmId);
    }
  }

  return map;
}

function loadClearedWithAgent(chargebackIds: string[]) {
  return prisma.clientEvent.findMany({
    where: { crmId: { in: chargebackIds }, isCleared: true },
    orderBy: { id: "desc" },
    include: { agentPeriod: true, period: true },
  });
}

type ResolvedPaid = {
  crmId: string;
  cordobaId: string;
  clientName?: string | null;
  source?: string | null;
};

type ResolvedChargeback = CordobaChargebackRow & {
  crmId: string;
  cordobaId: string;
};

export async function ingestCordobaUpload(
  fileBytes: Uint8Array | Buffer | ArrayBuffer,
  filename: string,
  uploadedById?: string,
): Promise<SaveCordobaSummary> {
  const parsed = await parseCordobaPayout(fileBytes);

  const batch = await prisma.uploadBatch.create({
    data: {
      type: UploadType.cordoba,
      filename,
      uploadedById: uploadedById || null,
    },
  });

  const summary: SaveCordobaSummary = {
    uploadBatchId: batch.id,
    paidNew: 0,
    paidUnmatched: [],
    chargebackSeenNew: 0,
    chargebackUnmatched: [],
    clawbacksApplied: 0,
    clawbackTotal: 0,
    snapshotsListed: 0,
    snapshotsUpdated: 0,
    skippedNotCommissioned: [],
    skippedNotConfirmedPaid: [],
    skippedAlreadyClawed: [],
    skippedNoDroppedDate: [],
    errors: [...parsed.errors],
  };

  const allCordobaIds = [
    ...parsed.paidIds.map((r) => r.crmId),
    ...parsed.chargebacks.map((r) => r.crmId),
  ];
  const cordobaToCrm = await resolveCordobaIdToCrmId(allCordobaIds);

  // ── Paid flags (batched; keys = CRM ID after External ID resolve) ─────────
  const paidUnique = new Map<string, ResolvedPaid>();
  for (const row of parsed.paidIds) {
    if (!row.crmId) continue;
    const crmId = cordobaToCrm.get(row.crmId);
    if (!crmId) {
      if (!summary.paidUnmatched.some((x) => x.includes(row.crmId))) {
        summary.paidUnmatched.push(label(row.clientName, row.crmId));
      }
      continue;
    }
    if (paidUnique.has(crmId)) continue;
    paidUnique.set(crmId, {
      crmId,
      cordobaId: row.crmId,
      clientName: row.clientName,
      source: row.source,
    });
  }

  const paidCrmIds = [...paidUnique.values()].map((r) => r.crmId);
  const alreadyPaid = new Set(
    paidCrmIds.length
      ? (
          await prisma.cordobaPaid.findMany({
            where: { crmId: { in: paidCrmIds } },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );
  const newPaid = [...paidUnique.values()]
    .filter((r) => !alreadyPaid.has(r.crmId))
    .map((r) => ({
      crmId: r.crmId,
      clientName: r.clientName || null,
      source: r.source || null,
      uploadedFilename: filename,
    }));
  for (let i = 0; i < newPaid.length; i += CHUNK) {
    await prisma.cordobaPaid.createMany({
      data: newPaid.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  summary.paidNew = newPaid.length;

  // ── Chargeback seen (display, batched) ────────────────────────────────────
  const byCrm = new Map<string, ResolvedChargeback>();
  for (const row of parsed.chargebacks) {
    if (!row.crmId) continue;
    const crmId = cordobaToCrm.get(row.crmId);
    if (!crmId) {
      summary.chargebackUnmatched.push(label(row.clientName, row.crmId));
      continue;
    }
    if (byCrm.has(crmId)) continue;
    byCrm.set(crmId, { ...row, crmId, cordobaId: row.crmId });
  }

  const chargebackCrmIds = [...byCrm.keys()];

  const knownEventIds = new Set(
    chargebackCrmIds.length
      ? (
          await prisma.clientEvent.findMany({
            where: { crmId: { in: chargebackCrmIds } },
            select: { crmId: true },
            distinct: ["crmId"],
          })
        ).map((r) => r.crmId)
      : [],
  );

  const matchedChargebacks: ResolvedChargeback[] = [];
  for (const row of byCrm.values()) {
    if (!knownEventIds.has(row.crmId)) {
      summary.chargebackUnmatched.push(label(row.clientName, row.cordobaId));
      continue;
    }
    matchedChargebacks.push(row);
  }

  const matchedIds = matchedChargebacks.map((r) => r.crmId);
  const alreadySeen = new Set(
    matchedIds.length
      ? (
          await prisma.cordobaChargebackSeen.findMany({
            where: { crmId: { in: matchedIds } },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );
  const newSeen = matchedChargebacks
    .filter((r) => !alreadySeen.has(r.crmId))
    .map((r) => ({
      crmId: r.crmId,
      clientName: r.clientName || null,
      uploadedFilename: filename,
    }));
  for (let i = 0; i < newSeen.length; i += CHUNK) {
    await prisma.cordobaChargebackSeen.createMany({
      data: newSeen.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  summary.chargebackSeenNew = newSeen.length;

  // ── Money chargebacks ─────────────────────────────────────────────────────
  const alreadyClawed = new Set(
    chargebackCrmIds.length
      ? (
          await prisma.clientEvent.findMany({
            where: { crmId: { in: chargebackCrmIds }, clawbackApplied: true },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );

  const confirmedPaid = new Set(
    chargebackCrmIds.length
      ? (
          await prisma.cordobaPaid.findMany({
            where: { crmId: { in: chargebackCrmIds } },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );

  const clearedByCrm = new Map<
    string,
    Awaited<ReturnType<typeof loadClearedWithAgent>>[number]
  >();
  const dropByCrm = new Map<
    string,
    { droppedDate: string | null; clientName: string | null }
  >();
  if (chargebackCrmIds.length) {
    const clearedRows = await loadClearedWithAgent(chargebackCrmIds);
    for (const e of clearedRows) {
      if (!clearedByCrm.has(e.crmId)) clearedByCrm.set(e.crmId, e);
    }
    const dropRows = await prisma.clientEvent.findMany({
      where: {
        crmId: { in: chargebackCrmIds },
        AND: [{ droppedDate: { not: null } }, { droppedDate: { not: "" } }],
      },
      orderBy: { id: "desc" },
      select: { crmId: true, droppedDate: true, clientName: true },
    });
    for (const e of dropRows) {
      if (!dropByCrm.has(e.crmId)) dropByCrm.set(e.crmId, e);
    }
  }

  const periodCache = new Map<string, Awaited<ReturnType<typeof getOrCreateHoldingAgentPeriod>>>();
  async function holding(periodLabel: string, agentName: string) {
    const key = `${periodLabel}::${agentName}`;
    let hit = periodCache.get(key);
    if (!hit) {
      hit = await getOrCreateHoldingAgentPeriod(periodLabel, agentName, filename);
      periodCache.set(key, hit);
    }
    return hit;
  }

  const moneySeen = new Set<string>();
  const touchedAgentPeriods = new Map<string, string>();

  for (const row of matchedChargebacks) {
    const { crmId, cordobaId } = row;
    if (!crmId || moneySeen.has(crmId)) continue;
    moneySeen.add(crmId);

    if (alreadyClawed.has(crmId)) {
      summary.skippedAlreadyClawed.push(label(row.clientName, cordobaId));
      continue;
    }

    const cleared = clearedByCrm.get(crmId);
    if (!cleared) {
      summary.skippedNotCommissioned.push(label(row.clientName, cordobaId));
      continue;
    }

    if (!confirmedPaid.has(crmId)) {
      summary.skippedNotConfirmedPaid.push(label(row.clientName, cordobaId));
      continue;
    }

    const withDrop = dropByCrm.get(crmId);
    const droppedPeriod = periodOf(parseDate(withDrop?.droppedDate || ""));
    if (!droppedPeriod) {
      summary.skippedNoDroppedDate.push(
        label(row.clientName || cleared.clientName, cordobaId),
      );
      continue;
    }

    const agentName = cleared.agentName;
    const clientDebt = Number(cleared.enrolledDebt) || 0;
    const origAp = cleared.agentPeriod;
    const knownPaidRate =
      cleared.paidRate != null && Number(cleared.paidRate) > 0
        ? Number(cleared.paidRate)
        : null;

    let cb = 0;
    if (knownPaidRate != null) {
      // History Rate / super-admin override: debt × paidRate (same as CRM clawbacks).
      cb = clawbackAmountFromPaidRate(clientDebt, knownPaidRate);
    } else if (origAp && origAp.unitsCleared > 0) {
      cb = calculateClawbackAmount(
        origAp.unitsCleared,
        Number(origAp.totalClearedDebt),
        Number(origAp.grossCommission),
        Number(origAp.cancellationRate),
        clientDebt,
        agentName,
      );
    } else {
      cb = Math.round(clientDebt * (getFixedRate(agentName) || 0.01) * 100) / 100;
    }
    if (cb <= 0) continue;

    const { period, agentPeriod } = await holding(droppedPeriod, agentName);
    const note = `Cordoba chargeback: -$${cb.toFixed(2)} for ${cleared.clientName || cordobaId} (External ID ${cordobaId})`;

    await prisma.clientEvent.create({
      data: {
        crmId,
        periodId: period.id,
        agentPeriodId: agentPeriod.id,
        agentName,
        kind: ClientEventKind.cordoba_clawback,
        clientName: cleared.clientName,
        enrolledDate: cleared.enrolledDate,
        firstPaymentClearedDate: cleared.firstPaymentClearedDate,
        droppedDate: withDrop?.droppedDate || cleared.droppedDate,
        payFreq: cleared.payFreq,
        paymentsMade: cleared.paymentsMade,
        enrolledDebt: dec(clientDebt),
        isCleared: false,
        clawbackApplied: true,
        commissionOnClient: dec(0),
        clawbackAmount: dec(cb),
        paidRate: knownPaidRate != null ? dec(knownPaidRate) : null,
        uploadBatchId: batch.id,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        type: LedgerType.clawback_cordoba,
        amount: dec(cb),
        crmId,
        agentName,
        periodId: period.id,
        agentPeriodId: agentPeriod.id,
        reasonCode: "cordoba_clawback",
        note,
        uploadBatchId: batch.id,
      },
    });

    touchedAgentPeriods.set(agentPeriod.id, note);
    alreadyClawed.add(crmId);
    summary.clawbacksApplied += 1;
    summary.clawbackTotal = Math.round((summary.clawbackTotal + cb) * 100) / 100;
  }

  for (const [agentPeriodId, note] of touchedAgentPeriods) {
    await recomputeAgentPeriodClawbacks(agentPeriodId, note);
  }

  // ── Snapshots (display UPSERT, batched reads) ─────────────────────────────
  const snapCandidates = matchedChargebacks;
  const snapIds = snapCandidates.map((r) => r.crmId);
  const eventsByCrm = new Map<
    string,
    {
      isCleared: boolean;
      clawbackApplied: boolean;
      droppedDate: string | null;
      clientName: string | null;
      agentName: string;
    }[]
  >();
  if (snapIds.length) {
    const allEvents = await prisma.clientEvent.findMany({
      where: { crmId: { in: snapIds } },
      orderBy: { id: "desc" },
      select: {
        crmId: true,
        isCleared: true,
        clawbackApplied: true,
        droppedDate: true,
        clientName: true,
        agentName: true,
      },
    });
    for (const e of allEvents) {
      const list = eventsByCrm.get(e.crmId) ?? [];
      list.push(e);
      eventsByCrm.set(e.crmId, list);
    }
  }

  const existingSnaps = new Set(
    snapIds.length
      ? (
          await prisma.cordobaChargebackSnapshot.findMany({
            where: { crmId: { in: snapIds } },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );

  const toCreate: Prisma.CordobaChargebackSnapshotCreateManyInput[] = [];
  const toUpdate: {
    crmId: string;
    data: Omit<Prisma.CordobaChargebackSnapshotCreateManyInput, "crmId">;
  }[] = [];

  for (const row of snapCandidates) {
    const events = eventsByCrm.get(row.crmId) ?? [];
    const wasPaid = events.some((e) => e.isCleared || e.clawbackApplied);
    const withDrop = events.find((e) => e.droppedDate && e.droppedDate.trim());
    const droppedPeriod = periodOf(parseDate(withDrop?.droppedDate || ""));
    if (!droppedPeriod || !wasPaid || !withDrop) continue;

    const data = {
      agentName: withDrop.agentName,
      periodLabel: droppedPeriod,
      assignedCompany: row.assignedCompany || null,
      enrolledDate: row.enrolledDate,
      clientName: row.clientName || withDrop.clientName,
      status: row.status || null,
      marketingPayoutDebt: dec(row.marketingPayoutDebt),
      firstPaymentClearedDate: row.firstPaymentClearedDate,
      payFreq: row.payFreq || null,
      paymentsMade: row.paymentsMade,
      marketingPaymentCleared: row.marketingPaymentCleared,
      marketingPaymentChargeback: row.marketingPaymentChargeback,
      fileDroppedDate: row.fileDroppedDate,
      uploadedFilename: filename,
    };

    if (existingSnaps.has(row.crmId)) {
      toUpdate.push({ crmId: row.crmId, data });
    } else {
      toCreate.push({ crmId: row.crmId, ...data });
      existingSnaps.add(row.crmId);
    }
  }

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.cordobaChargebackSnapshot.createMany({
      data: toCreate.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  summary.snapshotsListed = toCreate.length;

  for (const u of toUpdate) {
    await prisma.cordobaChargebackSnapshot.update({
      where: { crmId: u.crmId },
      data: u.data,
    });
    summary.snapshotsUpdated += 1;
  }

  summary.clawbackTotal = Math.round(summary.clawbackTotal * 100) / 100;

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { summaryJson: summary as object },
  });

  return summary;
}

async function getOrCreateHoldingAgentPeriod(
  periodLabel: string,
  agentName: string,
  filename: string,
) {
  let period = await prisma.commissionPeriod.findFirst({
    where: { periodLabel, source: PeriodSource.calculated },
  });
  if (!period) {
    const closed = isPeriodClosedByPayday(periodLabel);
    period = await prisma.commissionPeriod.create({
      data: {
        periodLabel,
        source: PeriodSource.calculated,
        status: closed ? PeriodStatus.closed : PeriodStatus.open,
        filename,
        closedAt: closed ? new Date() : null,
      },
    });
  }

  let agentPeriod = await prisma.agentPeriod.findFirst({
    where: { periodId: period.id, agentName },
  });
  if (!agentPeriod) {
    agentPeriod = await prisma.agentPeriod.create({
      data: {
        periodId: period.id,
        agentName,
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
        notes: null,
      },
    });
  }

  return { period, agentPeriod };
}
