import { prisma } from "@/lib/db";
import {
  isPoisonedDebtDroppedDate,
  parseDate,
} from "@/lib/commission/crm-parser";
import { dismissalKey, listDismissedKeys } from "@/lib/agents/dismissal";
import { DailyFollowUpDay } from "@/generated/prisma/client";
import {
  followUpDueYmd,
  followUpTargets,
  shiftYmd,
  ymdFromParsed,
} from "@/lib/portal/daily-tasks-dates";
import type {
  DailyTaskChannel,
  DailyTaskChecklist,
  DailyTaskFile,
  FollowUpKind,
} from "@/lib/portal/daily-tasks-types";

export {
  followUpDueYmd,
  followUpTargets,
  nextBusinessDayOnOrAfter,
  pacificTodayYmd,
  shiftYmd,
  ymdFromParsed,
} from "@/lib/portal/daily-tasks-dates";

export type {
  DailyTaskChannel,
  DailyTaskChecklist,
  DailyTaskFile,
  FollowUpKind,
} from "@/lib/portal/daily-tasks-types";

function hasRealDroppedDate(droppedDate: string | null | undefined): boolean {
  const raw = (droppedDate || "").trim();
  if (!raw) return false;
  if (isPoisonedDebtDroppedDate(raw)) return false;
  return Boolean(parseDate(raw));
}

/** Paid + Active — no day-1/5 outreach needed. */
function isClearedActiveFile(row: {
  firstPaymentClearedDate: string | null;
  crmStatus: string | null;
}): boolean {
  const cleared = (row.firstPaymentClearedDate || "").trim();
  if (!cleared) return false;
  const status = (row.crmStatus || "").trim().toLowerCase();
  return status === "active";
}

function emptyChecklist(): DailyTaskChecklist {
  return { emailDone: false, smsDone: false, callDone: false };
}

type IdentityRow = {
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  phone: string | null;
  enrolledDebt: { toString(): string } | number | null;
  enrolledDate: string | null;
  firstPaymentDate: string | null;
  firstPaymentClearedDate: string | null;
  payFreq: string | null;
  crmStatus: string | null;
  salesRep: string | null;
  droppedDate: string | null;
};

function collectDueFiles(
  identities: IdentityRow[],
  todayYmd: string,
  enrolledFrom: string,
): DailyTaskFile[] {
  const out: DailyTaskFile[] = [];
  for (const row of identities) {
    if (hasRealDroppedDate(row.droppedDate)) continue;
    if (isClearedActiveFile(row)) continue;
    const parsed = parseDate(row.enrolledDate || "");
    if (!parsed) continue;
    const enrolledYmd = ymdFromParsed(parsed);
    if (enrolledYmd < enrolledFrom) continue;

    const baseFields = {
      crmId: row.crmId,
      externalId: row.externalId,
      clientName: row.clientName,
      phone: row.phone,
      enrolledDebt: row.enrolledDebt != null ? Number(row.enrolledDebt) : null,
      enrolledDate: row.enrolledDate,
      enrolledYmd,
      firstPaymentDate: row.firstPaymentDate,
      firstPaymentClearedDate: row.firstPaymentClearedDate,
      payFreq: row.payFreq,
      crmStatus: row.crmStatus,
      salesRep: row.salesRep,
      checklist: emptyChecklist(),
    };

    if (followUpDueYmd(enrolledYmd, 1) === todayYmd) {
      out.push({ ...baseFields, followUp: "day1" });
    }
    if (followUpDueYmd(enrolledYmd, 5) === todayYmd) {
      out.push({ ...baseFields, followUp: "day5" });
    }
  }
  return out;
}

async function attachCompletions(
  files: DailyTaskFile[],
  opts: { agentId?: string },
): Promise<DailyTaskFile[]> {
  if (files.length === 0) return files;
  const crmIds = [...new Set(files.map((f) => f.crmId))];
  const completions = await prisma.dailyTaskCompletion.findMany({
    where: {
      crmId: { in: crmIds },
      followUp: { in: [DailyFollowUpDay.day1, DailyFollowUpDay.day5] },
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
    },
    include: opts.agentId
      ? undefined
      : { agent: { select: { id: true, displayName: true } } },
  });

  const byKey = new Map(
    completions.map((c) => [
      `${c.agentId}:${c.crmId}:${c.followUp}:${c.enrolledYmd}`,
      c,
    ]),
  );

  return files.map((file) => {
    const agentId = file.agentId || opts.agentId;
    if (!agentId) return file;
    const hit = byKey.get(
      `${agentId}:${file.crmId}:${file.followUp}:${file.enrolledYmd}`,
    );
    if (!hit) return file;
    return {
      ...file,
      checklist: {
        emailDone: hit.emailDone,
        smsDone: hit.smsDone,
        callDone: hit.callDone,
      },
    };
  });
}

/**
 * Day-1 / day-5 follow-ups for one portal login (their CRM aliases).
 * Excludes dropped + Active-with-1st-cleared. Weekends/holidays roll forward.
 */
export async function listDailyTasksForAgent(opts: {
  agentId: string;
  aliasNames: string[];
  now?: Date;
}): Promise<{
  todayYmd: string;
  day1Ymd: string;
  day5Ymd: string;
  day1: DailyTaskFile[];
  day5: DailyTaskFile[];
}> {
  const { todayYmd, day1Ymd, day5Ymd } = followUpTargets(opts.now);
  const dismissed = await listDismissedKeys();
  const names = [
    ...new Set(
      opts.aliasNames
        .map((n) => n.trim())
        .filter((n) => n && !dismissed.has(dismissalKey(n))),
    ),
  ];
  if (!names.length) {
    return { todayYmd, day1Ymd, day5Ymd, day1: [], day5: [] };
  }

  const enrolledFrom = shiftYmd(todayYmd, -24);
  const identities = await prisma.clientIdentity.findMany({
    where: {
      salesRep: { in: names },
      enrolledDate: { not: null },
    },
    select: {
      crmId: true,
      externalId: true,
      clientName: true,
      phone: true,
      enrolledDebt: true,
      enrolledDate: true,
      firstPaymentDate: true,
      firstPaymentClearedDate: true,
      payFreq: true,
      crmStatus: true,
      salesRep: true,
      droppedDate: true,
    },
  });

  const due = collectDueFiles(identities, todayYmd, enrolledFrom).map((f) => ({
    ...f,
    agentId: opts.agentId,
  }));
  const withChecks = await attachCompletions(due, { agentId: opts.agentId });

  const day1 = withChecks
    .filter((f) => f.followUp === "day1")
    .sort((a, b) =>
      (a.clientName || a.crmId).localeCompare(b.clientName || b.crmId),
    );
  const day5 = withChecks
    .filter((f) => f.followUp === "day5")
    .sort((a, b) =>
      (a.clientName || a.crmId).localeCompare(b.clientName || b.crmId),
    );

  return { todayYmd, day1Ymd, day5Ymd, day1, day5 };
}

/**
 * Admin team view: all due day-1/5 files across sales reps, with portal agent
 * + Email/SMS/Call completion when the rep is mapped to a login.
 */
export async function listDailyTasksForAdmin(opts?: { now?: Date }): Promise<{
  todayYmd: string;
  day1Ymd: string;
  day5Ymd: string;
  day1: DailyTaskFile[];
  day5: DailyTaskFile[];
}> {
  const { todayYmd, day1Ymd, day5Ymd } = followUpTargets(opts?.now);
  const enrolledFrom = shiftYmd(todayYmd, -24);
  const dismissed = await listDismissedKeys();

  const [identities, aliases] = await Promise.all([
    prisma.clientIdentity.findMany({
      where: { enrolledDate: { not: null } },
      select: {
        crmId: true,
        externalId: true,
        clientName: true,
        phone: true,
        enrolledDebt: true,
        enrolledDate: true,
        firstPaymentDate: true,
        firstPaymentClearedDate: true,
        payFreq: true,
        crmStatus: true,
        salesRep: true,
        droppedDate: true,
      },
    }),
    prisma.agentAlias.findMany({
      include: {
        agent: { select: { id: true, displayName: true, suspendedAt: true } },
      },
    }),
  ]);

  const aliasToAgent = new Map<
    string,
    { id: string; displayName: string }
  >();
  for (const a of aliases) {
    if (a.agent.suspendedAt) continue;
    if (dismissed.has(dismissalKey(a.agentName))) continue;
    aliasToAgent.set(a.agentName, {
      id: a.agent.id,
      displayName: a.agent.displayName,
    });
  }

  const scoped = identities.filter((row) => {
    const rep = (row.salesRep || "").trim();
    if (!rep) return false;
    if (dismissed.has(dismissalKey(rep))) return false;
    return true;
  });

  const due = collectDueFiles(scoped, todayYmd, enrolledFrom).map((f) => {
    const rep = (f.salesRep || "").trim();
    const agent = aliasToAgent.get(rep);
    return {
      ...f,
      agentId: agent?.id ?? null,
      agentDisplayName: agent?.displayName ?? null,
    };
  });

  const withChecks = await attachCompletions(due, {});

  const sortKey = (a: DailyTaskFile, b: DailyTaskFile) => {
    const an = (a.agentDisplayName || a.salesRep || "").localeCompare(
      b.agentDisplayName || b.salesRep || "",
    );
    if (an !== 0) return an;
    return (a.clientName || a.crmId).localeCompare(b.clientName || b.crmId);
  };

  const day1 = withChecks.filter((f) => f.followUp === "day1").sort(sortKey);
  const day5 = withChecks.filter((f) => f.followUp === "day5").sort(sortKey);

  return { todayYmd, day1Ymd, day5Ymd, day1, day5 };
}

export async function setDailyTaskChannel(opts: {
  agentId: string;
  crmId: string;
  followUp: FollowUpKind;
  enrolledYmd: string;
  channel: DailyTaskChannel;
  done: boolean;
}): Promise<DailyTaskChecklist> {
  const followUp =
    opts.followUp === "day1" ? DailyFollowUpDay.day1 : DailyFollowUpDay.day5;
  const now = new Date();
  const patch =
    opts.channel === "email"
      ? { emailDone: opts.done, emailDoneAt: opts.done ? now : null }
      : opts.channel === "sms"
        ? { smsDone: opts.done, smsDoneAt: opts.done ? now : null }
        : { callDone: opts.done, callDoneAt: opts.done ? now : null };

  const row = await prisma.dailyTaskCompletion.upsert({
    where: {
      agentId_crmId_followUp_enrolledYmd: {
        agentId: opts.agentId,
        crmId: opts.crmId,
        followUp,
        enrolledYmd: opts.enrolledYmd,
      },
    },
    create: {
      agentId: opts.agentId,
      crmId: opts.crmId,
      followUp,
      enrolledYmd: opts.enrolledYmd,
      ...patch,
    },
    update: patch,
  });

  return {
    emailDone: row.emailDone,
    smsDone: row.smsDone,
    callDone: row.callDone,
  };
}
