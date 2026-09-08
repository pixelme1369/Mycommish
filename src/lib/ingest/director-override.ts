/**
 * Alex Tambouly Director override: period “Units cleared” × marginal bands.
 * Same file basis as admin/manager period totals and the old all-period TLB
 * (AgentPeriod.unitsCleared, excluding currently dismissed / openers / period-excluded).
 * Applied on CRM period create / roster-like status changes for open periods.
 */

import { prisma } from "@/lib/db";
import {
  LedgerType,
  PeriodSource,
  PeriodStatus,
  Prisma,
} from "@/generated/prisma/client";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { listOpenerAliasKeys } from "@/lib/agents/opener";
import { listExcludedKeysForPeriod } from "@/lib/agents/period-exclusion";
import { agentIdentityKey } from "@/lib/commission/calculator";
import {
  ALEX_DIRECTOR_CANONICAL_NAME,
  calculateDirectorOverride,
  isAlexDirectorIdentity,
  isAlexDirectorPlan,
  parseDirectorOverrideNote,
} from "@/lib/commission/director-plan";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export async function applyDirectorOverrideToOpenPeriods() {
  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated, status: PeriodStatus.open },
    select: { id: true },
  });
  for (const p of periods) {
    await applyDirectorOverrideForPeriod(p.id);
  }
}

export async function applyDirectorOverrideForPeriodLabel(periodLabel: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: {
      periodLabel,
      source: PeriodSource.calculated,
    },
    select: { id: true },
  });
  if (!period) return;
  await applyDirectorOverrideForPeriod(period.id);
}

/**
 * Period “Units cleared” total — same basis as admin period header
 * (exclude currently dismissed / openers / period-excluded).
 */
export async function countCompanyUnitsClearedForPeriod(
  periodId: string,
  periodLabel: string,
): Promise<number> {
  const [agentPeriods, dismissedKeys, openerKeys, excludedKeys] = await Promise.all([
    prisma.agentPeriod.findMany({
      where: { periodId },
      select: { agentName: true, unitsCleared: true },
    }),
    listDismissedKeys(),
    listOpenerAliasKeys(),
    listExcludedKeysForPeriod(periodLabel),
  ]);
  let companyFiles = 0;
  for (const ap of agentPeriods) {
    const key = agentIdentityKey(ap.agentName);
    if (dismissedKeys.has(key) || openerKeys.has(key) || excludedKeys.has(key)) {
      continue;
    }
    companyFiles += ap.unitsCleared;
  }
  return companyFiles;
}

/**
 * Write/replace director_override ledger for Alex on one calculated period.
 * No-op when period is closed or before 2026-09.
 */
export async function applyDirectorOverrideForPeriod(periodId: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) return;
  if (period.status === PeriodStatus.closed) return;
  if (!isAlexDirectorPlan(ALEX_DIRECTOR_CANONICAL_NAME, period.periodLabel)) {
    await clearDirectorOverride(periodId);
    return;
  }

  const [agentPeriods, companyFiles] = await Promise.all([
    prisma.agentPeriod.findMany({
      where: { periodId },
      select: {
        id: true,
        agentName: true,
        cancellationRate: true,
      },
    }),
    countCompanyUnitsClearedForPeriod(periodId, period.periodLabel),
  ]);

  const alexPeriod = agentPeriods.find((ap) => isAlexDirectorIdentity(ap.agentName));
  const personalCancelRatePct = alexPeriod ? Number(alexPeriod.cancellationRate) : 0;
  const result = calculateDirectorOverride({
    companySurvivingFiles: companyFiles,
    personalCancelRatePct,
  });

  // Director plan replaces the old flat team-lead bonus — strip any leftover TLB first.
  if (alexPeriod) {
    await clearTeamLeadBonusForAgentPeriod(alexPeriod.id);
  }

  await setDirectorOverride({
    periodId,
    amount: result.amount,
    note: result.note,
    preferredAgentName: alexPeriod?.agentName ?? ALEX_DIRECTOR_CANONICAL_NAME,
  });
}

async function clearTeamLeadBonusForAgentPeriod(agentPeriodId: string) {
  const existing = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId,
      type: LedgerType.team_lead_bonus,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  let removed = false;
  for (const e of existing) {
    if (e.reversedBy) continue;
    await prisma.ledgerEntry.delete({ where: { id: e.id } });
    removed = true;
  }
  if (!removed) return;

  const ap = await prisma.agentPeriod.findUnique({ where: { id: agentPeriodId } });
  if (!ap) return;
  let notes = ap.notes || "";
  notes = notes
    .replace(/\s*\|\s*Team-lead bonus only[^\|]*/gi, "")
    .replace(/^Team-lead bonus only[^\|]*(\s*\|\s*)?/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();
  await prisma.agentPeriod.update({
    where: { id: agentPeriodId },
    data: {
      teamLeadBonusAmount: dec(0),
      notes: notes || null,
    },
  });
}

async function clearDirectorOverride(periodId: string) {
  const rows = await prisma.agentPeriod.findMany({
    where: { periodId },
    select: { id: true, agentName: true },
  });
  for (const ap of rows) {
    if (!isAlexDirectorIdentity(ap.agentName)) continue;
    await setDirectorOverride({
      periodId,
      amount: 0,
      note: "",
      preferredAgentName: ap.agentName,
    });
  }
}

async function setDirectorOverride(opts: {
  periodId: string;
  amount: number;
  note: string;
  preferredAgentName: string;
}) {
  const all = await prisma.agentPeriod.findMany({
    where: { periodId: opts.periodId },
  });
  let ap = all.find((r) => isAlexDirectorIdentity(r.agentName)) ?? null;

  if (!ap && opts.amount <= 0) return;

  if (!ap) {
    ap = await prisma.agentPeriod.create({
      data: {
        periodId: opts.periodId,
        agentName: opts.preferredAgentName,
        unitsCleared: 0,
        notes: "Director override only (no personal clears this period)",
      },
    });
  } else {
    // Replace stale "team-lead bonus only" holding note once Director plan owns the row.
    const stale = (ap.notes || "").match(/team-lead bonus only/i);
    if (stale) {
      const cleaned = (ap.notes || "")
        .replace(/\s*\|\s*Team-lead bonus only[^\|]*/gi, "")
        .replace(/^Team-lead bonus only[^\|]*(\s*\|\s*)?/i, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
        .trim();
      await prisma.agentPeriod.update({
        where: { id: ap.id },
        data: {
          notes:
            cleaned ||
            (opts.amount > 0 && ap.unitsCleared === 0
              ? "Director override only (no personal clears this period)"
              : null),
        },
      });
      ap = (await prisma.agentPeriod.findUnique({ where: { id: ap.id } }))!;
    }
  }

  const existing = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId: ap.id,
      type: LedgerType.director_override,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  for (const e of existing) {
    if (e.reversedBy) continue;
    await prisma.ledgerEntry.delete({ where: { id: e.id } });
  }

  if (opts.amount > 0) {
    await prisma.ledgerEntry.create({
      data: {
        type: LedgerType.director_override,
        amount: dec(opts.amount),
        agentName: ap.agentName,
        periodId: opts.periodId,
        agentPeriodId: ap.id,
        reasonCode: "director_override",
        note: opts.note,
      },
    });
  }

  await recomputeAgentPeriodClawbacks(ap.id);
}

export type DirectorOverrideBreakdown = {
  amount: number;
  companyFiles: number;
  penaltyApplied: boolean;
  note: string | null;
  slices: { label: string; files: number; rate: number; amount: number }[];
};

export async function getDirectorOverrideBreakdown(
  agentPeriodId: string,
): Promise<DirectorOverrideBreakdown | null> {
  const entry = await prisma.ledgerEntry.findFirst({
    where: {
      agentPeriodId,
      type: LedgerType.director_override,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
    orderBy: { createdAt: "desc" },
  });
  if (!entry || entry.reversedBy) return null;
  const amount = Math.round(Number(entry.amount) * 100) / 100;
  if (amount <= 0) return null;

  const ap = await prisma.agentPeriod.findUnique({
    where: { id: agentPeriodId },
    select: {
      cancellationRate: true,
      periodId: true,
      period: { select: { periodLabel: true } },
    },
  });
  if (!ap) return null;

  const parsed = parseDirectorOverrideNote(entry.note);
  let companyFiles = await countCompanyUnitsClearedForPeriod(
    ap.periodId,
    ap.period.periodLabel,
  );
  if (companyFiles <= 0 && parsed?.companyFiles) {
    companyFiles = parsed.companyFiles;
  }

  const recomputed = calculateDirectorOverride({
    companySurvivingFiles: companyFiles,
    personalCancelRatePct: Number(ap.cancellationRate),
  });

  return {
    amount: recomputed.amount || amount,
    companyFiles: recomputed.companyFiles,
    penaltyApplied: recomputed.penaltyApplied,
    note: entry.note,
    slices: recomputed.slices,
  };
}
