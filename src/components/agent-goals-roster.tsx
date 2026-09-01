"use client";

import { useMemo, useState } from "react";
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
import { formatRoleLabel } from "@/lib/roles";
import type { AgentGoalRosterRow, GoalPaceStatus } from "@/lib/portal/monthly-goal-view";
import { cn } from "@/lib/utils";

function compactUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    const digits = Number.isInteger(m) || abs >= 10_000_000 ? 0 : 1;
    return `$${m.toFixed(digits)}M`;
  }
  if (abs >= 10_000) return `$${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function progressPct(row: AgentGoalRosterRow): number {
  if (row.view.debtGoal > 0) return row.view.debtPct;
  if (row.view.unitsGoal > 0) return row.view.unitsPct;
  return 0;
}

const STATUS_LABEL: Record<GoalPaceStatus, string> = {
  behind: "Behind",
  on_track: "On track",
  hit: "Hit",
  no_goal: "No goal",
};

export function AgentGoalsRoster({
  monthTitle,
  rows,
}: {
  monthTitle: string;
  rows: AgentGoalRosterRow[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle),
    );
  }, [q, rows]);

  const withGoal = rows.filter((r) => r.view.hasGoal);
  const totalGoal = withGoal.reduce((s, r) => s + r.view.debtGoal, 0);
  const totalEnrolled = rows.reduce((s, r) => s + r.view.debtActual, 0);
  const totalUnitsGoal = withGoal.reduce((s, r) => s + r.view.unitsGoal, 0);
  const totalUnits = rows.reduce((s, r) => s + r.view.unitsActual, 0);
  const behind = rows.filter((r) => r.paceStatus === "behind").length;
  const hit = rows.filter((r) => r.paceStatus === "hit").length;

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Goals set · {monthTitle}</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {withGoal.length}
            <span className="text-base font-normal text-muted-foreground">
              /{rows.length}
            </span>
          </p>
        </Card>
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Enrolled vs goal</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {compactUsd(totalEnrolled)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {compactUsd(totalGoal)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {totalUnits} files
            {totalUnitsGoal > 0 ? ` · ${totalUnitsGoal} unit goal` : ""}
          </p>
        </Card>
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Pace</p>
          <p className="mt-1 font-heading text-2xl tracking-tight">
            {hit} hit
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              · {behind} behind
            </span>
          </p>
        </Card>
      </div>

      <div className="max-w-sm">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agents"
          aria-label="Search agents"
          className="h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="glass-panel p-6 text-sm text-muted-foreground">
          {rows.length === 0
            ? "No agents to show."
            : "No names match that search."}
        </Card>
      ) : (
        <Card className="glass-panel overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Goal</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">Pace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const pct = progressPct(row);
                return (
                  <TableRow key={row.agentId}>
                    <TableCell>
                      <p className="font-medium">{row.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRoleLabel(row.role)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.paceStatus === "hit"
                            ? "default"
                            : row.paceStatus === "behind"
                              ? "destructive"
                              : row.paceStatus === "on_track"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {STATUS_LABEL[row.paceStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactUsd(row.view.debtActual)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.view.hasGoal ? compactUsd(row.view.debtGoal) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.view.hasGoal ? (
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.paceStatus === "hit"
                                  ? "bg-primary"
                                  : row.paceStatus === "behind"
                                    ? "bg-destructive"
                                    : "bg-foreground/70",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.view.unitsActual}
                      {row.view.unitsGoal > 0 ? (
                        <span className="text-muted-foreground">
                          /{row.view.unitsGoal}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.view.enrolledToday > 0
                        ? `${row.view.enrolledToday} · ${compactUsd(row.view.debtToday)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.view.hasGoal && row.view.dailyPace > 0
                        ? `${row.view.dailyPace}/day`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
