import { prisma } from "@/lib/db";
import { PeriodSource, type ClientEventKind } from "@/generated/prisma/client";
import { dismissalKey, listDismissedKeys } from "@/lib/agents/dismissal";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { latestCalculatedPeriods } from "@/lib/portal/queries";

export type AgentFileRow = {
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  kind: ClientEventKind;
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  periodId: string;
  periodLabel: string;
  agentPeriodId: string | null;
  agentName: string;
};

function activeAliases(aliasNames: string[], dismissed: Set<string>) {
  return aliasNames.filter((n) => !dismissed.has(dismissalKey(n)));
}

function aliasKeySet(aliasNames: string[]) {
  return new Set(aliasNames.map((n) => agentIdentityKey(n)));
}

/** Deduped CRM files for this agent in the latest calculated window. */
export async function listAgentFiles(aliasNames: string[]): Promise<AgentFileRow[]> {
  const dismissed = await listDismissedKeys();
  const names = activeAliases(aliasNames, dismissed);
  if (!names.length) return [];

  const periods = await latestCalculatedPeriods();
  if (!periods.length) return [];

  const periodById = new Map(periods.map((p) => [p.id, p]));
  const events = await prisma.clientEvent.findMany({
    where: {
      agentName: { in: names },
      periodId: { in: periods.map((p) => p.id) },
      period: { source: PeriodSource.calculated },
    },
    include: { identity: { select: { externalId: true } } },
    orderBy: [{ clientName: "asc" }, { crmId: "asc" }],
  });

  const byCrm = new Map<string, AgentFileRow>();
  for (const e of events) {
    const period = periodById.get(e.periodId);
    if (!period) continue;
    const prev = byCrm.get(e.crmId);
    if (prev && prev.periodLabel >= period.periodLabel) continue;
    byCrm.set(e.crmId, {
      crmId: e.crmId,
      externalId: e.identity?.externalId ?? null,
      clientName: e.clientName,
      kind: e.kind,
      enrolledDate: e.enrolledDate,
      firstPaymentClearedDate: e.firstPaymentClearedDate,
      droppedDate: e.droppedDate,
      periodId: e.periodId,
      periodLabel: period.periodLabel,
      agentPeriodId: e.agentPeriodId,
      agentName: e.agentName,
    });
  }

  return [...byCrm.values()].sort((a, b) =>
    (a.clientName || a.crmId).localeCompare(b.clientName || b.crmId),
  );
}

export type FileLookupHit = {
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  kind: ClientEventKind | "not_yet_cleared" | "directory";
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  periodLabel: string | null;
  agentName: string;
  crmStatus: string | null;
};

export type FileLookupOutcome =
  | "not_found"
  | "not_assigned"
  | "assigned"
  | "ambiguous"
  | "no_aliases";

export type FileLookupResult = {
  mode: "id" | "name";
  outcome: FileLookupOutcome;
  hits: FileLookupHit[];
  otherRep?: { crmId: string; externalId: string | null; clientName: string | null; agentName: string };
};

/**
 * Lookup by External ID (agent-facing; = Cordoba ID) or name.
 * Also accepts CRM ID for admin/debug. Uses ClientIdentity directory + latest ClientEvent.
 */
export async function lookupAgentFiles(
  aliasNames: string[],
  query: string,
): Promise<FileLookupResult> {
  const q = query.trim();
  if (!q) return { mode: "name", outcome: "not_found", hits: [] };

  const dismissed = await listDismissedKeys();
  const names = activeAliases(aliasNames, dismissed);
  if (!names.length) return { mode: "name", outcome: "no_aliases", hits: [] };

  const mine = aliasKeySet(names);
  const looksLikeId = /^[\d]{5,}$/.test(q.replace(/\s/g, ""));
  const mode: "id" | "name" = looksLikeId ? "id" : "name";
  const idQ = q.replace(/\s/g, "");

  const identities = await prisma.clientIdentity.findMany({
    where:
      mode === "id"
        ? { OR: [{ crmId: idQ }, { externalId: idQ }] }
        : { clientName: { contains: q, mode: "insensitive" } },
    take: 25,
    orderBy: { clientName: "asc" },
  });

  if (!identities.length) {
    // Fallback: events only (older uploads before directory fields)
    const events = await prisma.clientEvent.findMany({
      where: {
        period: { source: PeriodSource.calculated },
        ...(mode === "id"
          ? { crmId: idQ }
          : { clientName: { contains: q, mode: "insensitive" } }),
      },
      include: {
        period: { select: { periodLabel: true } },
        identity: { select: { externalId: true, crmStatus: true } },
      },
      orderBy: [{ period: { periodLabel: "desc" } }],
      take: 25,
    });
    if (!events.length) return { mode, outcome: "not_found", hits: [] };

    const byCrm = new Map<string, FileLookupHit>();
    for (const e of events) {
      if (byCrm.has(e.crmId)) continue;
      byCrm.set(e.crmId, {
        crmId: e.crmId,
        externalId: e.identity?.externalId ?? null,
        clientName: e.clientName,
        kind: e.kind,
        enrolledDate: e.enrolledDate,
        firstPaymentClearedDate: e.firstPaymentClearedDate,
        droppedDate: e.droppedDate,
        periodLabel: e.period.periodLabel,
        agentName: e.agentName,
        crmStatus: e.identity?.crmStatus ?? null,
      });
    }
    return classifyHits([...byCrm.values()], mine, mode);
  }

  const crmIds = identities.map((i) => i.crmId);
  const events = await prisma.clientEvent.findMany({
    where: {
      crmId: { in: crmIds },
      period: { source: PeriodSource.calculated },
    },
    include: { period: { select: { periodLabel: true } } },
    orderBy: [{ period: { periodLabel: "desc" } }],
  });
  const latestEventByCrm = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    if (!latestEventByCrm.has(e.crmId)) latestEventByCrm.set(e.crmId, e);
  }

  const hits: FileLookupHit[] = identities.map((i) => {
    const ev = latestEventByCrm.get(i.crmId);
    return {
      crmId: i.crmId,
      externalId: i.externalId,
      clientName: i.clientName,
      kind: ev?.kind ?? (i.firstPaymentClearedDate ? "directory" : "not_yet_cleared"),
      enrolledDate: ev?.enrolledDate ?? i.enrolledDate,
      firstPaymentClearedDate: ev?.firstPaymentClearedDate ?? i.firstPaymentClearedDate,
      droppedDate: ev?.droppedDate ?? i.droppedDate,
      periodLabel: ev?.period.periodLabel ?? null,
      agentName: ev?.agentName ?? i.salesRep ?? "",
      crmStatus: i.crmStatus,
    };
  });

  return classifyHits(hits, mine, mode);
}

function classifyHits(
  all: FileLookupHit[],
  mine: Set<string>,
  mode: "id" | "name",
): FileLookupResult {
  if (!all.length) return { mode, outcome: "not_found", hits: [] };

  const mineHits = all.filter((h) => mine.has(agentIdentityKey(h.agentName)));
  const otherHits = all.filter((h) => !mine.has(agentIdentityKey(h.agentName)));

  if (mineHits.length === 1) return { mode, outcome: "assigned", hits: mineHits };
  if (mineHits.length > 1) return { mode, outcome: "ambiguous", hits: mineHits.slice(0, 8) };

  if (otherHits.length >= 1) {
    const o = otherHits[0];
    return {
      mode,
      outcome: "not_assigned",
      hits: [],
      otherRep: {
        crmId: o.crmId,
        externalId: o.externalId,
        clientName: o.clientName,
        agentName: o.agentName || "unknown",
      },
    };
  }

  return { mode, outcome: "not_found", hits: [] };
}
