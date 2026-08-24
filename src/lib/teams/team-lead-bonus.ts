/**
 * Team-lead per-unit bonuses: roster in TeamLead/TeamMember;
 * credited on CRM period create / roster save for open periods.
 */

import { prisma } from "@/lib/db";
import {
  LedgerType,
  PeriodSource,
  PeriodStatus,
  Prisma,
} from "@/generated/prisma/client";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { listExcludedKeysForPeriod } from "@/lib/agents/period-exclusion";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { computeTeamLeadBonusAmount } from "@/lib/commission/net";
import { recomputeAgentPeriodClawbacks } from "@/lib/ingest/recompute-agent-period";

function dec(n: number) {
  return new Prisma.Decimal(n);
}

export type TeamLeadBonusScopeName = "roster" | "all_period_units";

export type TeamLeadView = {
  id: string;
  leadAgentId: string;
  leadDisplayName: string;
  leadAgentName: string;
  ratePerUnit: number;
  bonusScope: TeamLeadBonusScopeName;
  members: { id: string; memberAgentName: string }[];
};

function asScope(raw: string | null | undefined): TeamLeadBonusScopeName {
  return raw === "all_period_units" ? "all_period_units" : "roster";
}

export async function listTeamLeads(): Promise<TeamLeadView[]> {
  const rows = await prisma.teamLead.findMany({
    include: {
      leadAgent: { select: { displayName: true } },
      members: { orderBy: { memberAgentName: "asc" } },
    },
    orderBy: { leadAgent: { displayName: "asc" } },
  });
  return rows.map((r) => ({
    id: r.id,
    leadAgentId: r.leadAgentId,
    leadDisplayName: r.leadAgent.displayName,
    leadAgentName: r.leadAgentName,
    ratePerUnit: Number(r.ratePerUnit),
    bonusScope: asScope(r.bonusScope),
    members: r.members.map((m) => ({
      id: m.id,
      memberAgentName: m.memberAgentName,
    })),
  }));
}

export async function upsertTeamLead(opts: {
  leadAgentId: string;
  leadAgentName: string;
  ratePerUnit: number;
  bonusScope: TeamLeadBonusScopeName;
  memberNames: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const leadAgentName = opts.leadAgentName.trim();
  if (!leadAgentName) return { ok: false, error: "Pick the lead’s CRM Sales Rep name." };
  const rate = Number(opts.ratePerUnit);
  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: "Rate per unit must be a non-negative number." };
  }

  const bonusScope = asScope(opts.bonusScope);

  const agent = await prisma.agent.findUnique({
    where: { id: opts.leadAgentId },
    include: { aliases: true },
  });
  if (!agent) return { ok: false, error: "Lead agent not found." };

  const aliasOk = agent.aliases.some(
    (a) => a.agentName.toLowerCase() === leadAgentName.toLowerCase(),
  );
  if (!aliasOk) {
    return {
      ok: false,
      error: "CRM name must be one of this user’s Sales Rep aliases.",
    };
  }

  const members =
    bonusScope === "all_period_units"
      ? []
      : [
          ...new Map(
            opts.memberNames
              .map((n) => n.trim())
              .filter(Boolean)
              .filter((n) => n.toLowerCase() !== leadAgentName.toLowerCase())
              .map((n) => [agentIdentityKey(n), n] as const),
          ).values(),
        ];

  if (bonusScope === "roster" && members.length === 0) {
    return {
      ok: false,
      error: "Pick at least one team member, or choose “All period units”.",
    };
  }

  const existing = await prisma.teamLead.findUnique({
    where: { leadAgentId: opts.leadAgentId },
  });

  let teamLeadId: string;
  if (existing) {
    teamLeadId = existing.id;
    await prisma.$transaction([
      prisma.teamMember.deleteMany({ where: { teamLeadId } }),
      prisma.teamLead.update({
        where: { id: teamLeadId },
        data: {
          leadAgentName,
          ratePerUnit: dec(Math.round(rate * 100) / 100),
          bonusScope,
        },
      }),
      ...members.map((name) =>
        prisma.teamMember.create({
          data: {
            teamLeadId,
            memberAgentName: name,
            memberAgentNameKey: agentIdentityKey(name),
          },
        }),
      ),
    ]);
  } else {
    const created = await prisma.teamLead.create({
      data: {
        leadAgentId: opts.leadAgentId,
        leadAgentName,
        ratePerUnit: dec(Math.round(rate * 100) / 100),
        bonusScope,
        members: {
          create: members.map((name) => ({
            memberAgentName: name,
            memberAgentNameKey: agentIdentityKey(name),
          })),
        },
      },
    });
    teamLeadId = created.id;
  }

  await applyTeamLeadBonusesToOpenPeriods();
  return { ok: true, id: teamLeadId };
}

export async function deleteTeamLead(
  teamLeadId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.teamLead.findUnique({ where: { id: teamLeadId } });
  if (!row) return { ok: false, error: "Team lead not found." };

  const openPeriods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated, status: PeriodStatus.open },
    select: { id: true },
  });
  for (const p of openPeriods) {
    await clearTeamLeadBonusForPeriod(p.id, row.leadAgentName);
  }

  await prisma.teamLead.delete({ where: { id: teamLeadId } });
  return { ok: true };
}

async function clearTeamLeadBonusForPeriod(periodId: string, leadAgentName: string) {
  const ap = await prisma.agentPeriod.findUnique({
    where: { periodId_agentName: { periodId, agentName: leadAgentName } },
  });
  if (!ap) return;

  const existing = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId: ap.id,
      type: LedgerType.team_lead_bonus,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  for (const e of existing) {
    if (e.reversedBy) continue;
    await prisma.ledgerEntry.delete({ where: { id: e.id } });
  }
  await recomputeAgentPeriodClawbacks(ap.id);
}

/** Re-apply team-lead bonuses for every open calculated period. */
export async function applyTeamLeadBonusesToOpenPeriods() {
  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated, status: PeriodStatus.open },
    select: { id: true },
  });
  for (const p of periods) {
    await applyTeamLeadBonusesForPeriod(p.id);
  }
}

/**
 * Write/replace team_lead_bonus ledger rows for one calculated period.
 * No-op when period is closed.
 */
export async function applyTeamLeadBonusesForPeriod(periodId: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) return;
  if (period.status === PeriodStatus.closed) return;

  const leads = await prisma.teamLead.findMany({
    include: { members: true },
  });
  if (leads.length === 0) return;

  const [agentPeriods, dismissedKeys, excludedKeys] = await Promise.all([
    prisma.agentPeriod.findMany({
      where: { periodId },
      select: { id: true, agentName: true, unitsCleared: true },
    }),
    listDismissedKeys(),
    listExcludedKeysForPeriod(period.periodLabel),
  ]);

  /** Match admin/manager “Units cleared”: skip dismissed + period-excluded agents. */
  function countsTowardPeriodUnits(agentName: string) {
    const key = agentIdentityKey(agentName);
    return !dismissedKeys.has(key) && !excludedKeys.has(key);
  }

  const unitsByKey = new Map<string, number>();
  let periodUnitsTotal = 0;
  for (const ap of agentPeriods) {
    if (!countsTowardPeriodUnits(ap.agentName)) continue;
    const key = agentIdentityKey(ap.agentName);
    unitsByKey.set(key, ap.unitsCleared);
    periodUnitsTotal += ap.unitsCleared;
  }

  for (const lead of leads) {
    let teamUnits = 0;
    let notePrefix = "Team bonus";
    if (lead.bonusScope === "all_period_units") {
      teamUnits = periodUnitsTotal;
      notePrefix = "Period units bonus";
    } else {
      for (const m of lead.members) {
        if (
          dismissedKeys.has(m.memberAgentNameKey) ||
          excludedKeys.has(m.memberAgentNameKey)
        ) {
          continue;
        }
        teamUnits += unitsByKey.get(m.memberAgentNameKey) ?? 0;
      }
    }
    const amount = computeTeamLeadBonusAmount(teamUnits, Number(lead.ratePerUnit));
    await setTeamLeadBonus({
      periodId,
      leadAgentName: lead.leadAgentName,
      amount,
      teamUnits,
      ratePerUnit: Number(lead.ratePerUnit),
      notePrefix,
    });
  }
}

async function setTeamLeadBonus(opts: {
  periodId: string;
  leadAgentName: string;
  amount: number;
  teamUnits: number;
  ratePerUnit: number;
  notePrefix: string;
}) {
  let ap = await prisma.agentPeriod.findUnique({
    where: {
      periodId_agentName: {
        periodId: opts.periodId,
        agentName: opts.leadAgentName,
      },
    },
  });

  if (!ap && opts.amount <= 0) return;

  if (!ap) {
    ap = await prisma.agentPeriod.create({
      data: {
        periodId: opts.periodId,
        agentName: opts.leadAgentName,
        unitsCleared: 0,
        notes: "Team-lead bonus only (no personal clears this period)",
      },
    });
  }

  const existing = await prisma.ledgerEntry.findMany({
    where: {
      agentPeriodId: ap.id,
      type: LedgerType.team_lead_bonus,
      reversesEntryId: null,
    },
    include: { reversedBy: true },
  });
  for (const e of existing) {
    if (e.reversedBy) continue;
    await prisma.ledgerEntry.delete({ where: { id: e.id } });
  }

  if (opts.amount > 0) {
    const rateLabel = opts.ratePerUnit.toFixed(2).replace(/\.00$/, "");
    await prisma.ledgerEntry.create({
      data: {
        type: LedgerType.team_lead_bonus,
        amount: dec(opts.amount),
        agentName: opts.leadAgentName,
        periodId: opts.periodId,
        agentPeriodId: ap.id,
        reasonCode: "team_lead_bonus",
        note: `${opts.notePrefix}: ${opts.teamUnits} unit${opts.teamUnits === 1 ? "" : "s"} × $${rateLabel}`,
      },
    });
  }

  await recomputeAgentPeriodClawbacks(ap.id);
}
