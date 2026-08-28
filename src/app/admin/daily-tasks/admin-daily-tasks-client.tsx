"use client";

import { useMemo, useState } from "react";
import type { DailyTaskFile, FollowUpKind } from "@/lib/portal/daily-tasks-types";
import { formatPhoneForDisplay } from "@/lib/agents/phone";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function doneCount(c: DailyTaskFile["checklist"]) {
  return Number(c.emailDone) + Number(c.smsDone) + Number(c.callDone);
}

function ChannelPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-[3rem] items-center justify-center rounded-md px-1.5 text-[10px] font-medium tracking-wide",
        done
          ? "bg-primary/15 text-money ring-1 ring-primary/25"
          : "bg-muted/60 text-muted-foreground ring-1 ring-border/50",
      )}
    >
      {done ? `✓ ${label}` : label}
    </span>
  );
}

function AdminTasksTable({ files }: { files: DailyTaskFile[] }) {
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
            <TableHead className="min-w-[8rem]">Agent</TableHead>
            <TableHead className="min-w-[10rem]">Client</TableHead>
            <TableHead>Home phone</TableHead>
            <TableHead>Debt</TableHead>
            <TableHead>Enrolled</TableHead>
            <TableHead>1st payment</TableHead>
            <TableHead>1st cleared</TableHead>
            <TableHead>Pay freq</TableHead>
            <TableHead className="min-w-[8rem]">Status</TableHead>
            <TableHead className="min-w-[12rem] text-right">Outreach</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const complete = doneCount(file.checklist);
            const allDone = complete === 3;
            const phoneDisplay =
              formatPhoneForDisplay(file.phone) || file.phone || "—";
            const agentLabel =
              file.agentDisplayName || file.salesRep || "Unmapped";
            return (
              <TableRow
                key={`${file.followUp}-${file.crmId}-${file.agentId || file.salesRep}`}
                className={cn(allDone && "bg-muted/20")}
              >
                <TableCell className="align-middle">
                  <p className="font-medium">{agentLabel}</p>
                  {file.agentDisplayName && file.salesRep ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {file.salesRep}
                    </p>
                  ) : !file.agentId ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      No portal login
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="align-middle">
                  <p className="truncate font-medium">
                    {file.clientName || "—"}
                  </p>
                  {file.externalId ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {file.externalId}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="align-middle tabular-nums">
                  {phoneDisplay}
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
                  <span className="line-clamp-2 max-w-[12rem] text-sm text-muted-foreground">
                    {file.crmStatus || "—"}
                  </span>
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      <ChannelPill label="Email" done={file.checklist.emailDone} />
                      <ChannelPill label="SMS" done={file.checklist.smsDone} />
                      <ChannelPill label="Call" done={file.checklist.callDone} />
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
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminDailyTasksWorkspace({
  day3,
  day10,
  todayYmd,
}: {
  day3: DailyTaskFile[];
  day10: DailyTaskFile[];
  todayYmd: string;
}) {
  const [tab, setTab] = useState<FollowUpKind>("day3");
  const [q, setQ] = useState("");

  const active = tab === "day3" ? day3 : day10;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return active;
    return active.filter(
      (f) =>
        (f.agentDisplayName || "").toLowerCase().includes(needle) ||
        (f.salesRep || "").toLowerCase().includes(needle) ||
        (f.clientName || "").toLowerCase().includes(needle) ||
        (f.externalId || "").toLowerCase().includes(needle) ||
        (f.crmId || "").toLowerCase().includes(needle),
    );
  }, [active, q]);

  const stats = useMemo(() => {
    const all = [...day3, ...day10];
    const due = all.length;
    const finished = all.filter((f) => doneCount(f.checklist) === 3).length;
    return { due, finished, remaining: due - finished };
  }, [day3, day10]);

  const tabs: Array<{ id: FollowUpKind; label: string; count: number }> = [
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
          <div className="flex flex-wrap items-center gap-3">
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
                        selected &&
                          "border-primary/30 bg-primary/10 text-foreground",
                      )}
                    >
                      {t.count}
                    </Badge>
                  </button>
                );
              })}
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter agent, client, External ID…"
              className="h-8 w-[16rem]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Queue{" "}
            <span className="tabular-nums text-foreground">{todayYmd}</span> PT ·
            read-only completions
          </p>
        </div>

        <AdminTasksTable files={filtered} />
      </Card>

      <p className="text-xs text-muted-foreground">
        Team-wide day-3 / day-10 queue · Email / SMS / Call show what each agent marked · unmapped
        sales reps have no checklist until aliased to a login
      </p>
    </div>
  );
}
