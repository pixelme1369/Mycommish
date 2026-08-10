/**
 * Cordoba payout ingest — paid evidence + chargebacks onto calculated periods.
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

function label(clientName: string | null | undefined, crmId: string) {
  return clientName ? `${clientName} (${crmId})` : crmId;
}

const CHUNK = 500;

export type SaveCordobaSummary = {
  uploadBatchId: string;
  paidNew: number;
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

async function ensureIdentities(
  rows: { crmId: string; clientName?: string | null }[],
) {
  const byId = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.crmId || byId.has(r.crmId)) continue;
    byId.set(r.crmId, r.clientName || null);
  }
  const data = [...byId.entries()].map(([crmId, clientName]) => ({
    crmId,
    clientName,
  }));
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.clientIdentity.createMany({
      data: data.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
}

function loadClearedWithAgent(chargebackIds: string[]) {
  return prisma.clientEvent.findMany({
    where: { crmId: { in: chargebackIds }, isCleared: true },
    orderBy: { id: "desc" },
    include: { agentPeriod: true, period: true },
  });
}

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

  // ── Paid flags (batched) ──────────────────────────────────────────────────
  const paidUnique = new Map<
    string,
    { crmId: string; clientName?: string | null; source?: string | null }
  >();
  for (const row of parsed.paidIds) {
    if (!row.crmId || paidUnique.has(row.crmId)) continue;
    paidUnique.set(row.crmId, row);
  }
  await ensureIdentities([...paidUnique.values()]);

  const paidIds = [...paidUnique.keys()];
  const alreadyPaid = new Set(
    paidIds.length
      ? (
          await prisma.cordobaPaid.findMany({
            where: { crmId: { in: paidIds } },
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
  const chargebackUnique = new Map<string, CordobaChargebackRow>();
  for (const row of parsed.chargebacks) {
    if (!row.crmId || chargebackUnique.has(row.crmId)) continue;
    chargebackUnique.set(row.crmId, row);
  }
  const chargebackIds = [...chargebackUnique.keys()];

  const knownEventIds = new Set(
    chargebackIds.length
      ? (
          await prisma.clientEvent.findMany({
            where: { crmId: { in: chargebackIds } },
            select: { crmId: true },
            distinct: ["crmId"],
          })
        ).map((r) => r.crmId)
      : [],
  );

  const matchedChargebacks: CordobaChargebackRow[] = [];
  for (const [crmId, row] of chargebackUnique) {
    if (!knownEventIds.has(crmId)) {
      summary.chargebackUnmatched.push(label(row.clientName, crmId));
      continue;
    }
    matchedChargebacks.push(row);
  }

  await ensureIdentities(matchedChargebacks);

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
    chargebackIds.length
      ? (
          await prisma.clientEvent.findMany({
            where: { crmId: { in: chargebackIds }, clawbackApplied: true },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );

  const confirmedPaid = new Set(
    chargebackIds.length
      ? (
          await prisma.cordobaPaid.findMany({
            where: { crmId: { in: chargebackIds } },
            select: { crmId: true },
          })
        ).map((r) => r.crmId)
      : [],
  );

  // Prefetch cleared + any-drop events for all chargeback IDs (avoids N+1).
  const clearedByCrm = new Map<
    string,
    Awaited<ReturnType<typeof loadClearedWithAgent>>[number]
  >();
  const dropByCrm = new Map<
    string,
    { droppedDate: string | null; clientName: string | null }
  >();
  if (chargebackIds.length) {
    const clearedRows = await loadClearedWithAgent(chargebackIds);
    for (const e of clearedRows) {
      if (!clearedByCrm.has(e.crmId)) clearedByCrm.set(e.crmId, e);
    }
    const dropRows = await prisma.clientEvent.findMany({
      where: {
        crmId: { in: chargebackIds },
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

  for (const row of parsed.chargebacks) {
    const crmId = row.crmId;
    if (!crmId || moneySeen.has(crmId)) continue;
    moneySeen.add(crmId);

    if (alreadyClawed.has(crmId)) {
      summary.skippedAlreadyClawed.push(label(row.clientName, crmId));
      continue;
    }

    const cleared = clearedByCrm.get(crmId);
    if (!cleared) {
      summary.skippedNotCommissioned.push(label(row.clientName, crmId));
      continue;
    }

    if (!confirmedPaid.has(crmId)) {
      summary.skippedNotConfirmedPaid.push(label(row.clientName, crmId));
      continue;
    }

    const withDrop = dropByCrm.get(crmId);
    const droppedPeriod = periodOf(parseDate(withDrop?.droppedDate || ""));
    if (!droppedPeriod) {
      summary.skippedNoDroppedDate.push(label(row.clientName || cleared.clientName, crmId));
      continue;
    }

    const agentName = cleared.agentName;
    const clientDebt = Number(cleared.enrolledDebt) || 0;
    const origAp = cleared.agentPeriod;

    let cb = 0;
    if (origAp && origAp.unitsCleared > 0) {
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
    const note = `Cordoba chargeback: -$${cb.toFixed(2)} for ${cleared.clientName || crmId} (ID ${crmId})`;

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
  const snapCandidates = [...chargebackUnique.values()];
  const snapIds = snapCandidates.map((r) => r.crmId);
  const eventsByCrm = new Map<
    string,
    { isCleared: boolean; clawbackApplied: boolean; droppedDate: string | null; clientName: string | null; agentName: string }[]
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
  const snapIdentities: { crmId: string; clientName?: string | null }[] = [];

  for (const row of snapCandidates) {
    const events = eventsByCrm.get(row.crmId) ?? [];
    const wasPaid = events.some((e) => e.isCleared || e.clawbackApplied);
    const withDrop = events.find((e) => e.droppedDate && e.droppedDate.trim());
    const droppedPeriod = periodOf(parseDate(withDrop?.droppedDate || ""));
    if (!droppedPeriod || !wasPaid || !withDrop) continue;

    snapIdentities.push({
      crmId: row.crmId,
      clientName: row.clientName || withDrop.clientName,
    });

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

  await ensureIdentities(snapIdentities);

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.cordobaChargebackSnapshot.createMany({
      data: toCreate.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  summary.snapshotsListed = toCreate.length;

  // Updates are fewer (re-uploads); still sequential but tiny vs paid-tab N+1.
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
