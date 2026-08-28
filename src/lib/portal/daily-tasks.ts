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

function emptyChecklist(): DailyTaskChecklist {
  return { emailDone: false, smsDone: false, callDone: false };
}

/**
 * Exact-day follow-ups: files enrolled exactly 3 or 10 Pacific calendar days ago.
 * Excludes files with a real Dropped Date. Scoped to agent CRM aliases.
 */
export async function listDailyTasksForAgent(opts: {
  agentId: string;
  aliasNames: string[];
  now?: Date;
}): Promise<{
  todayYmd: string;
  day3Ymd: string;
  day10Ymd: string;
  day3: DailyTaskFile[];
  day10: DailyTaskFile[];
}> {
  const { todayYmd, day3Ymd, day10Ymd } = followUpTargets(opts.now);
  const dismissed = await listDismissedKeys();
  const names = [
    ...new Set(
      opts.aliasNames
        .map((n) => n.trim())
        .filter((n) => n && !dismissed.has(dismissalKey(n))),
    ),
  ];
  if (!names.length) {
    return { todayYmd, day3Ymd, day10Ymd, day3: [], day10: [] };
  }

  // Window wide enough for day-10 + holiday roll-forward (~2 weeks).
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

  const day3: DailyTaskFile[] = [];
  const day10: DailyTaskFile[] = [];

  for (const row of identities) {
    if (hasRealDroppedDate(row.droppedDate)) continue;
    const parsed = parseDate(row.enrolledDate || "");
    if (!parsed) continue;
    const enrolledYmd = ymdFromParsed(parsed);
    // Cheap prefilter — skip ancient enrollments before holiday math.
    if (enrolledYmd < enrolledFrom) continue;

    const due3 = followUpDueYmd(enrolledYmd, 3);
    const due10 = followUpDueYmd(enrolledYmd, 10);

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

    if (due3 === todayYmd) {
      day3.push({ ...baseFields, followUp: "day3" });
    }
    if (due10 === todayYmd) {
      day10.push({ ...baseFields, followUp: "day10" });
    }
  }

  const sortKey = (a: DailyTaskFile, b: DailyTaskFile) =>
    (a.clientName || a.crmId).localeCompare(b.clientName || b.crmId);
  day3.sort(sortKey);
  day10.sort(sortKey);

  const crmIds = [...new Set([...day3, ...day10].map((f) => f.crmId))];
  if (crmIds.length === 0) {
    return { todayYmd, day3Ymd, day10Ymd, day3, day10 };
  }

  const completions = await prisma.dailyTaskCompletion.findMany({
    where: {
      agentId: opts.agentId,
      crmId: { in: crmIds },
      followUp: { in: [DailyFollowUpDay.day3, DailyFollowUpDay.day10] },
    },
  });
  const byKey = new Map(
    completions.map((c) => [
      `${c.crmId}:${c.followUp}:${c.enrolledYmd}`,
      c,
    ]),
  );

  const apply = (file: DailyTaskFile) => {
    const hit = byKey.get(`${file.crmId}:${file.followUp}:${file.enrolledYmd}`);
    if (!hit) return file;
    return {
      ...file,
      checklist: {
        emailDone: hit.emailDone,
        smsDone: hit.smsDone,
        callDone: hit.callDone,
      },
    };
  };

  return {
    todayYmd,
    day3Ymd,
    day10Ymd,
    day3: day3.map(apply),
    day10: day10.map(apply),
  };
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
    opts.followUp === "day3" ? DailyFollowUpDay.day3 : DailyFollowUpDay.day10;
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
