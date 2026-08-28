"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toggleDailyTaskChannelAction } from "./actions";
import type {
  DailyTaskChecklist,
  DailyTaskFile,
  FollowUpKind,
} from "@/lib/portal/daily-tasks-types";
import { formatPhoneForDisplay } from "@/lib/agents/phone";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function doneCount(c: DailyTaskChecklist) {
  return Number(c.emailDone) + Number(c.smsDone) + Number(c.callDone);
}

function ChannelToggle({
  file,
  channel,
  label,
  checked,
  onCheckedChange,
}: {
  file: DailyTaskFile;
  channel: "email" | "sms" | "call";
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={checked}
      onClick={() => {
        const next = !checked;
        onCheckedChange(next);
        const fd = new FormData();
        fd.set("crmId", file.crmId);
        fd.set("followUp", file.followUp);
        fd.set("enrolledYmd", file.enrolledYmd);
        fd.set("channel", channel);
        fd.set("done", next ? "true" : "false");
        start(async () => {
          await toggleDailyTaskChannelAction(fd);
        });
      }}
      className={cn(
        "h-7 min-w-[3.25rem] rounded-md px-2 text-[11px] font-medium tracking-wide transition-colors",
        "ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "bg-primary text-primary-foreground ring-primary/30"
          : "bg-background text-muted-foreground ring-border/70 hover:bg-muted/60 hover:text-foreground",
        pending && "opacity-60",
      )}
    >
      {label}
    </button>
  );
}

function TaskTableRow({ file }: { file: DailyTaskFile }) {
  const [checklist, setChecklist] = useState<DailyTaskChecklist>(file.checklist);

  useEffect(() => {
    setChecklist(file.checklist);
  }, [file.checklist]);

  const complete = doneCount(checklist);
  const allDone = complete === 3;
  const phoneDisplay = formatPhoneForDisplay(file.phone) || file.phone;
  const phoneHref = file.phone
    ? `tel:${file.phone.replace(/[^\d+]/g, "")}`
    : null;

  return (
    <TableRow className={cn(allDone && "bg-muted/20")}>
      <TableCell className="align-middle">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {file.clientName || "—"}
          </p>
          {file.externalId ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {file.externalId}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="align-middle">
        {phoneHref && phoneDisplay ? (
          <a
            href={phoneHref}
            className="font-medium tabular-nums text-foreground underline-offset-2 hover:underline"
          >
            {phoneDisplay}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="align-middle tabular-nums">
        {file.enrolledDebt != null ? money(file.enrolledDebt) : "—"}
      </TableCell>
      <TableCell className="align-middle tabular-nums text-muted-foreground">
        {file.enrolledDate || "—"}
      </TableCell>
      <TableCell className="align-middle tabular-nums text-muted-foreground">
        {file.firstPaymentDate || "—"}
      </TableCell>
      <TableCell className="align-middle tabular-nums">
        {file.firstPaymentClearedDate ? (
          <span className="text-money">{file.firstPaymentClearedDate}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="align-middle text-sm">
        {file.payFreq || "—"}
      </TableCell>
      <TableCell className="align-middle">
        <span className="line-clamp-2 max-w-[14rem] text-sm text-muted-foreground">
          {file.crmStatus || "—"}
        </span>
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-1">
            <ChannelToggle
              file={file}
              channel="email"
              label="Email"
              checked={checklist.emailDone}
              onCheckedChange={(next) =>
                setChecklist((c) => ({ ...c, emailDone: next }))
              }
            />
            <ChannelToggle
              file={file}
              channel="sms"
              label="SMS"
              checked={checklist.smsDone}
              onCheckedChange={(next) =>
                setChecklist((c) => ({ ...c, smsDone: next }))
              }
            />
            <ChannelToggle
              file={file}
              channel="call"
              label="Call"
              checked={checklist.callDone}
              onCheckedChange={(next) =>
                setChecklist((c) => ({ ...c, callDone: next }))
              }
            />
          </div>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              allDone ? "font-medium text-money" : "text-muted-foreground",
            )}
          >
            {allDone ? "Done" : `${complete}/3`}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TasksTable({ files }: { files: DailyTaskFile[] }) {
  if (files.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        No files due for this follow-up today.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="min-w-[10rem]">Client</TableHead>
            <TableHead className="min-w-[8rem]">Home phone</TableHead>
            <TableHead>Debt</TableHead>
            <TableHead>Enrolled</TableHead>
            <TableHead>1st payment</TableHead>
            <TableHead>1st cleared</TableHead>
            <TableHead>Pay freq</TableHead>
            <TableHead className="min-w-[9rem]">Status</TableHead>
            <TableHead className="min-w-[13rem] text-right">Outreach</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => (
            <TaskTableRow key={`${f.followUp}-${f.crmId}`} file={f} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DailyTasksWorkspace({
  day3,
  day10,
  todayYmd,
}: {
  day3: DailyTaskFile[];
  day10: DailyTaskFile[];
  day3Ymd?: string;
  day10Ymd?: string;
  todayYmd: string;
}) {
  const [tab, setTab] = useState<FollowUpKind>("day3");

  const active = tab === "day3" ? day3 : day10;

  const stats = useMemo(() => {
    const all = [...day3, ...day10];
    const due = all.length;
    const finished = all.filter((f) => doneCount(f.checklist) === 3).length;
    const remaining = due - finished;
    return { due, finished, remaining };
  }, [day3, day10]);

  const tabs: Array<{
    id: FollowUpKind;
    label: string;
    count: number;
  }> = [
    { id: "day3", label: "Day 3", count: day3.length },
    { id: "day10", label: "Day 10", count: day10.length },
  ];

  return (
    <div className="mt-8 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-border/60">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Due today
          </p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {stats.due}
          </p>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-border/60">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Remaining
          </p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {stats.remaining}
          </p>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-border/60">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Completed
          </p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight text-money">
            {stats.finished}
          </p>
        </div>
      </div>

      <Card className="glass-panel overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 ring-1 ring-border/50">
            {tabs.map((t) => {
              const selected = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums",
                      selected && "border-primary/30 bg-primary/10 text-foreground",
                    )}
                  >
                    {t.count}
                  </Badge>
                </button>
              );
            })}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              Due{" "}
              <span className="tabular-nums text-foreground">{todayYmd}</span>{" "}
              PT
            </p>
            <p className="mt-0.5">
              {tab === "day3" ? "Enrolled + 3 days" : "Enrolled + 10 days"}
              {" · "}
              weekends/holidays roll forward
            </p>
          </div>
        </div>

        <TasksTable files={active} />
      </Card>

      <p className="text-xs text-muted-foreground">
        Enrolled + 3 or + 10 calendar days · weekends/US federal holidays roll forward · dropped
        files and Active files with 1st payment cleared are excluded · mark Email, SMS, and Call
      </p>
    </div>
  );
}

export default DailyTasksWorkspace;
