"use client";

import { useState } from "react";
import Link from "next/link";
import { CalculatedPeriodRowMenu } from "./period-row-menu";
import { DeleteAllPeriodsButton } from "./delete-bulk-periods-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardPeriodRow = {
  id: string;
  periodLabel: string;
  status: string;
  agentCount: number;
  filename: string | null;
  historyPeriodId?: string | null;
};

export function AdminCalculatedPeriods({
  openPeriods,
  closedPeriods,
}: {
  openPeriods: DashboardPeriodRow[];
  closedPeriods: DashboardPeriodRow[];
}) {
  const [showClosed, setShowClosed] = useState(false);
  const total = openPeriods.length + closedPeriods.length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl tracking-tight">Pay periods</h2>
        <div className="flex flex-wrap items-center gap-2">
          {closedPeriods.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {showClosed
                ? "Hide closed"
                : `Show closed (${closedPeriods.length})`}
            </button>
          ) : null}
          {total > 0 ? (
            <DeleteAllPeriodsButton kind="calculated" count={total} />
          ) : null}
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          None yet — import CRM in Import below.
        </p>
      ) : (
        <div className="space-y-4">
          {openPeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open periods
              {closedPeriods.length > 0 ? " — show closed or upload CRM." : "."}
            </p>
          ) : (
            <PeriodList periods={openPeriods} muted={false} />
          )}

          {showClosed && closedPeriods.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Closed · newest first
              </p>
              <PeriodList periods={closedPeriods} muted />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PeriodList({
  periods,
  muted,
}: {
  periods: DashboardPeriodRow[];
  muted: boolean;
}) {
  return (
    <Card
      className={cn("glass-panel overflow-hidden py-0", muted && "opacity-75")}
    >
      <ul className="divide-y divide-border/70">
        {periods.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                href={`/admin/periods/${p.id}`}
                className="font-medium hover:underline"
              >
                {p.periodLabel}
              </Link>
              <Badge
                variant={p.status === "open" ? "secondary" : "outline"}
                className="font-normal"
              >
                {p.status}
              </Badge>
              <span className="text-muted-foreground">{p.agentCount} agents</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/admin/periods/${p.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-muted-foreground",
                )}
              >
                Open
              </Link>
              <CalculatedPeriodRowMenu
                periodId={p.id}
                periodLabel={p.periodLabel}
                status={p.status}
                historyPeriodId={p.historyPeriodId}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
