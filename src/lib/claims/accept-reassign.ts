import { prisma } from "@/lib/db";
import { calculateAgentCommission, agentIdentityKey } from "@/lib/commission/calculator";
import { computeNetCommission } from "@/lib/commission/net";
import {
  ClientEventKind,
  FileClaimStatus,
  LedgerType,
  PeriodSource,
  PeriodStatus,
  Prisma,
  type ClientEvent,
  type PrismaClient,
} from "@/generated/prisma/client";

export const CLOSED_PERIOD_ERROR = "Commission already paid on the closed period.";

export type AcceptReassignResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type Db = PrismaClient | Prisma.TransactionClient;

function dec(n: number) {
  return new Prisma.Decimal(n);
}

/** Events that count toward AgentPeriod.unitsCleared (tier cohort). */
export function countsTowardUnits(kind: ClientEventKind, isLowCredit: boolean): boolean {
  if (kind === ClientEventKind.cleared) return true;
  if (kind === ClientEventKind.low_credit_cleared) return true;
  if (kind === ClientEventKind.safe_cancel) return true;
  // Defensive: some rows may still be kind=cleared with isLowCredit.
  void isLowCredit;
  return false;
}

/** Debt that contributes to totalClearedDebt / gross (excludes low-credit $0 units). */
export function debtTowardGross(event: {
  kind: ClientEventKind;
  isLowCredit: boolean;
  enrolledDebt: { toNumber?: () => number } | number;
}): number {
  if (event.isLowCredit) return 0;
  if (event.kind === ClientEventKind.low_credit_cleared) return 0;
  if (!countsTowardUnits(event.kind, event.isLowCredit)) return 0;
  const debt =
    typeof event.enrolledDebt === "number"
      ? event.enrolledDebt
      : Number(event.enrolledDebt);
  return debt;
}

export function sumUnitsAndDebt(
  events: Array<{
    kind: ClientEventKind;
    isLowCredit: boolean;
    enrolledDebt: { toNumber?: () => number } | number;
  }>,
): { unitsCleared: number; totalClearedDebt: number } {
  let unitsCleared = 0;
  let totalClearedDebt = 0;
  for (const e of events) {
    if (!countsTowardUnits(e.kind, e.isLowCredit)) continue;
    unitsCleared += 1;
    totalClearedDebt += debtTowardGross(e);
  }
  return {
    unitsCleared,
    totalClearedDebt: Math.round(totalClearedDebt * 100) / 100,
  };
}

export function commissionOnClientFor(
  event: { kind: ClientEventKind; isLowCredit: boolean; enrolledDebt: number },
  tierRate: number,
): number {
  if (event.isLowCredit) return 0;
  if (event.kind === ClientEventKind.low_credit_cleared) return 0;
  if (!countsTowardUnits(event.kind, event.isLowCredit)) return 0;
  return Math.round(event.enrolledDebt * tierRate * 100) / 100;
}

export async function resolveClaimIdentity(externalOrCrmId: string, db: Db = prisma) {
  const key = externalOrCrmId.trim();
  if (!key) return null;
  const byExternal = await db.clientIdentity.findFirst({
    where: { externalId: key },
  });
  if (byExternal) return byExternal;
  return db.clientIdentity.findFirst({ where: { crmId: key } });
}

/**
 * Accept a pending file claim:
 * - Always lock Sales Rep (`assignedSalesRep` + directory) so future CRM uploads keep it
 * - Move any *open* calculated ClientEvents / clawback ledger rows to the claimer
 *   (including dropped / clawback / cancelled rows)
 * - Never rewrite *closed* (already paid) periods — those stay as historical rows
 */
export async function acceptFileClaimReassign(opts: {
  claimId: string;
  reviewerId: string;
  adminNote: string | null;
}): Promise<AcceptReassignResult> {
  const claim = await prisma.fileClaim.findUnique({
    where: { id: opts.claimId },
    include: {
      agent: {
        include: { aliases: { orderBy: { agentName: "asc" } } },
      },
    },
  });
  if (!claim) return { ok: false, error: "Claim not found." };
  if (claim.status !== FileClaimStatus.pending) {
    return { ok: false, error: "Claim was already reviewed." };
  }

  const identity = await resolveClaimIdentity(claim.crmId);
  if (!identity) {
    return { ok: false, error: "File not in CRM directory." };
  }

  const claimerAlias = claim.agent.aliases[0]?.agentName?.trim();
  if (!claimerAlias) {
    return {
      ok: false,
      error: "Claimer has no Sales Rep alias — add one under Agents before accepting.",
    };
  }
  const claimerKey = agentIdentityKey(claimerAlias);

  const events = await prisma.clientEvent.findMany({
    where: {
      crmId: identity.crmId,
      period: { source: PeriodSource.calculated },
    },
    include: { period: { select: { id: true, status: true, periodLabel: true, source: true } } },
  });

  const openEvents = events.filter((e) => e.period.status === PeriodStatus.open);
  const closedCount = events.length - openEvents.length;
  const alreadyOnClaimer =
    agentIdentityKey(identity.salesRep || "") === claimerKey &&
    openEvents.every((e) => agentIdentityKey(e.agentName) === claimerKey);

  try {
    await prisma.$transaction(async (tx) => {
      if (!alreadyOnClaimer && openEvents.length > 0) {
        await reassignOpenEvents(tx, {
          identityCrmId: identity.crmId,
          claimerAlias,
          openEvents,
        });
      }

      await tx.clientIdentity.update({
        where: { crmId: identity.crmId },
        data: { salesRep: claimerAlias },
      });

      await tx.fileClaim.update({
        where: { id: claim.id },
        data: {
          status: FileClaimStatus.accepted,
          assignedSalesRep: claimerAlias,
          adminNote: opts.adminNote,
          reviewedById: opts.reviewerId,
          reviewedAt: new Date(),
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reassign claim.";
    return { ok: false, error: msg };
  }

  const closedNote =
    closedCount > 0
      ? ` Closed period row(s) left unchanged (${CLOSED_PERIOD_ERROR.replace(/\.$/, "")}).`
      : "";

  if (alreadyOnClaimer || openEvents.length === 0) {
    return {
      ok: true,
      message:
        openEvents.length === 0
          ? `Accepted — locked to ${claimerAlias} for future CRM uploads.${closedNote || " No open-period commission rows to move yet."}`
          : `Accepted — already assigned to claimer.${closedNote}`,
    };
  }

  return {
    ok: true,
    message: `Accepted — moved to ${claimerAlias} in open period(s) (incl. dropped/clawback rows).${closedNote}`,
  };
}

async function reassignOpenEvents(
  tx: Prisma.TransactionClient,
  opts: {
    identityCrmId: string;
    claimerAlias: string;
    openEvents: Array<
      ClientEvent & {
        period: { id: string; status: PeriodStatus; periodLabel: string };
      }
    >;
  },
) {
  const { identityCrmId, claimerAlias, openEvents } = opts;
  const affectedApIds = new Set<string>();
  const periodIds = [...new Set(openEvents.map((e) => e.periodId))];

  for (const periodId of periodIds) {
    const periodEvents = openEvents.filter((e) => e.periodId === periodId);
    const fromNames = [
      ...new Set(
        periodEvents
          .map((e) => e.agentName)
          .filter((n) => agentIdentityKey(n) !== agentIdentityKey(claimerAlias)),
      ),
    ];

    let claimerAp = await tx.agentPeriod.findUnique({
      where: { periodId_agentName: { periodId, agentName: claimerAlias } },
    });
    if (!claimerAp) {
      // Seed cancel rate from a donor AP in this period when possible.
      const donor =
        fromNames.length > 0
          ? await tx.agentPeriod.findFirst({
              where: { periodId, agentName: { in: fromNames } },
            })
          : await tx.agentPeriod.findFirst({ where: { periodId } });
      claimerAp = await tx.agentPeriod.create({
        data: {
          periodId,
          agentName: claimerAlias,
          cancellationRate: donor?.cancellationRate ?? dec(0),
        },
      });
    }
    affectedApIds.add(claimerAp.id);

    for (const e of periodEvents) {
      if (e.agentPeriodId) affectedApIds.add(e.agentPeriodId);
      if (agentIdentityKey(e.agentName) === agentIdentityKey(claimerAlias)) {
        if (e.agentPeriodId !== claimerAp.id) {
          await tx.clientEvent.update({
            where: { id: e.id },
            data: { agentPeriodId: claimerAp.id, agentName: claimerAlias },
          });
        }
        continue;
      }
      await tx.clientEvent.update({
        where: { id: e.id },
        data: {
          agentName: claimerAlias,
          agentPeriodId: claimerAp.id,
        },
      });
    }

    // Move per-client clawback ledger rows for this file in this period.
    const clawRows = await tx.ledgerEntry.findMany({
      where: {
        crmId: identityCrmId,
        periodId,
        type: {
          in: [LedgerType.clawback_crm, LedgerType.clawback_cordoba, LedgerType.clawback_history],
        },
        reversesEntryId: null,
      },
      include: { reversedBy: true },
    });
    for (const row of clawRows) {
      if (row.reversedBy) continue;
      if (row.agentPeriodId) affectedApIds.add(row.agentPeriodId);
      await tx.ledgerEntry.update({
        where: { id: row.id },
        data: {
          agentName: claimerAlias,
          agentPeriodId: claimerAp.id,
        },
      });
      affectedApIds.add(claimerAp.id);
    }
  }

  for (const apId of affectedApIds) {
    await recomputeAgentPeriodAfterReassign(tx, apId, identityCrmId);
  }
}

async function recomputeAgentPeriodAfterReassign(
  tx: Prisma.TransactionClient,
  agentPeriodId: string,
  movedCrmId: string,
) {
  const ap = await tx.agentPeriod.findUnique({ where: { id: agentPeriodId } });
  if (!ap) return;

  const events = await tx.clientEvent.findMany({
    where: { agentPeriodId },
  });

  const { unitsCleared, totalClearedDebt } = sumUnitsAndDebt(events);
  const cancelPct = Number(ap.cancellationRate);
  const pendingEvents = events.filter((e) => e.kind === ClientEventKind.pending);
  const pendingUnits = pendingEvents.length;
  const pendingDebt =
    Math.round(
      pendingEvents.reduce((s, e) => s + Number(e.enrolledDebt), 0) * 100,
    ) / 100;

  const calc =
    unitsCleared > 0
      ? calculateAgentCommission({
          agentName: ap.agentName,
          unitsCleared,
          totalClearedDebt,
          cancellationRatePct: cancelPct,
        })
      : {
          agentName: ap.agentName,
          unitsCleared: 0,
          totalClearedDebt: 0,
          cancellationRate: cancelPct,
          hourlyDraw: 0,
          rawTier: 0,
          adjustedTier: 0,
          tierRate: 0,
          grossCommission: 0,
          payout: 0,
          payoutType: "commission" as const,
          qualityBonusEligible: cancelPct < 10,
          cancellationPenaltyApplied: false,
          notes: "No cleared units after file-claim reassignment",
        };

  // Rewrite per-client commission at the new tier rate for tier-cohort events.
  for (const e of events) {
    if (!countsTowardUnits(e.kind, e.isLowCredit)) continue;
    const amount = commissionOnClientFor(
      {
        kind: e.kind,
        isLowCredit: e.isLowCredit,
        enrolledDebt: Number(e.enrolledDebt),
      },
      calc.tierRate,
    );
    if (Number(e.commissionOnClient) !== amount) {
      await tx.clientEvent.update({
        where: { id: e.id },
        data: { commissionOnClient: dec(amount) },
      });
    }
  }

  await replaceCommissionCredit(tx, {
    agentPeriodId: ap.id,
    periodId: ap.periodId,
    agentName: ap.agentName,
    newGross: Math.round(calc.grossCommission * 100) / 100,
    note: `file_claim_reassign:${movedCrmId}`,
  });

  const clawEntries = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: {
        in: [LedgerType.clawback_crm, LedgerType.clawback_cordoba, LedgerType.clawback_history],
      },
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const clawbackAmount =
    Math.round(
      clawEntries.filter((e) => !e.reversedBy).reduce((s, e) => s + Number(e.amount), 0) * 100,
    ) / 100;
  const bonusEntries = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: LedgerType.manual_bonus,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const manualBonusAmount =
    Math.round(
      bonusEntries.filter((e) => !e.reversedBy).reduce((s, e) => s + Number(e.amount), 0) * 100,
    ) / 100;
  const teamLeadEntries = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: LedgerType.team_lead_bonus,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const teamLeadBonusAmount =
    Math.round(
      teamLeadEntries
        .filter((e) => !e.reversedBy)
        .reduce((s, e) => s + Number(e.amount), 0) * 100,
    ) / 100;
  const advancePaidEntries = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: LedgerType.advance_paid,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const advancePaidAmount =
    Math.round(
      advancePaidEntries
        .filter((e) => !e.reversedBy)
        .reduce((s, e) => s + Number(e.amount), 0) * 100,
    ) / 100;
  const advanceRepayEntries = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: LedgerType.advance_repay,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const advanceRepayAmount =
    Math.round(
      advanceRepayEntries
        .filter((e) => !e.reversedBy)
        .reduce((s, e) => s + Number(e.amount), 0) * 100,
    ) / 100;
  const gross = Math.round(calc.grossCommission * 100) / 100;
  const netCommission = computeNetCommission(
    gross,
    clawbackAmount,
    manualBonusAmount,
    advancePaidAmount,
    advanceRepayAmount,
    teamLeadBonusAmount,
  );

  const noteBit = `file claim reassign ${movedCrmId}`;
  const notes = ap.notes?.includes(noteBit)
    ? ap.notes
    : ap.notes
      ? `${ap.notes} | ${noteBit}`
      : noteBit;

  await tx.agentPeriod.update({
    where: { id: agentPeriodId },
    data: {
      unitsCleared: calc.unitsCleared,
      totalClearedDebt: dec(calc.totalClearedDebt),
      rawTier: calc.rawTier,
      adjustedTier: calc.adjustedTier,
      tierRate: dec(calc.tierRate),
      grossCommission: dec(gross),
      clawbackAmount: dec(clawbackAmount),
      manualBonusAmount: dec(manualBonusAmount),
      teamLeadBonusAmount: dec(teamLeadBonusAmount),
      advancePaidAmount: dec(advancePaidAmount),
      advanceRepayAmount: dec(advanceRepayAmount),
      netCommission: dec(netCommission),
      payout: dec(netCommission),
      payoutType: calc.payoutType,
      qualityBonusEligible: calc.qualityBonusEligible,
      cancellationPenaltyApplied: calc.cancellationPenaltyApplied,
      pendingUnits,
      pendingDebt: dec(pendingDebt),
      notes,
    },
  });
}

async function replaceCommissionCredit(
  tx: Prisma.TransactionClient,
  opts: {
    agentPeriodId: string;
    periodId: string;
    agentName: string;
    newGross: number;
    note: string;
  },
) {
  const credits = await tx.ledgerEntry.findMany({
    where: {
      agentPeriodId: opts.agentPeriodId,
      type: LedgerType.commission_credit,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  const active = credits.filter((c) => !c.reversedBy);

  for (const c of active) {
    await tx.ledgerEntry.create({
      data: {
        type: LedgerType.reversal,
        amount: c.amount,
        agentName: opts.agentName,
        periodId: opts.periodId,
        agentPeriodId: opts.agentPeriodId,
        reasonCode: "file_claim_reassign_reversal",
        note: opts.note,
        reversesEntryId: c.id,
      },
    });
  }

  if (opts.newGross > 0) {
    await tx.ledgerEntry.create({
      data: {
        type: LedgerType.commission_credit,
        amount: dec(opts.newGross),
        agentName: opts.agentName,
        periodId: opts.periodId,
        agentPeriodId: opts.agentPeriodId,
        reasonCode: "file_claim_reassign_credit",
        note: opts.note,
      },
    });
  }
}
