"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DeleteAllPeriodsButton,
  DeleteUploadByFilenameButton,
} from "./delete-bulk-periods-button";
import { HistoryPeriodRowMenu } from "./period-row-menu";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HistoryPeriod = {
  id: string;
  periodLabel: string;
  agentCount: number;
};

type HistoryGroup = {
  filename: string;
  periods: HistoryPeriod[];
};

type UploadRow = {
  id: string;
  type: string;
  filename: string;
  createdAt: string;
};

export function AdminSecondarySections({
  historyGroups,
  historyCount,
  uploads,
}: {
  historyGroups: HistoryGroup[];
  historyCount: number;
  uploads: UploadRow[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [showBatches, setShowBatches] = useState(false);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg tracking-tight text-muted-foreground">
              History periods
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Audit only · {historyCount} period{historyCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {historyCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {showHistory ? "Hide" : "Show"}
              </button>
            ) : null}
            {historyCount > 0 ? (
              <DeleteAllPeriodsButton kind="history" count={historyCount} />
            ) : null}
          </div>
        </div>

        {historyCount === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : showHistory ? (
          <div className="mt-3 space-y-3">
            {historyGroups.map(({ filename, periods }) => (
              <Card
                key={`hist-${filename}`}
                className="glass-panel overflow-hidden py-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
                  <span className="truncate font-medium text-foreground/80">
                    {filename}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>
                      {periods.length} period{periods.length === 1 ? "" : "s"}
                    </span>
                    {filename !== "(no filename)" ? (
                      <DeleteUploadByFilenameButton
                        filename={filename}
                        kind="history"
                        periodCount={periods.length}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-border/70">
                  {periods.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/history/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.periodLabel}
                        </Link>
                        <span className="text-muted-foreground">
                          {p.agentCount} agents
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          href={`/admin/history/${p.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "text-muted-foreground",
                          )}
                        >
                          Open
                        </Link>
                        <HistoryPeriodRowMenu
                          periodId={p.id}
                          periodLabel={p.periodLabel}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      {uploads.length > 0 ? (
        <section className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-lg tracking-tight text-muted-foreground">
              Recent batches
            </h2>
            <button
              type="button"
              onClick={() => setShowBatches((v) => !v)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {showBatches ? "Hide" : `Show (${uploads.length})`}
            </button>
          </div>
          {showBatches ? (
            <Card className="glass-panel mt-3 overflow-hidden py-0">
              <ul className="divide-y divide-border/70">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className="shrink-0 font-normal">
                        {u.type}
                      </Badge>
                      <span className="truncate">{u.filename}</span>
                    </div>
                    <Link
                      href={`/admin/uploads/${u.id}`}
                      className="shrink-0 text-xs text-muted-foreground hover:underline"
                    >
                      {u.createdAt.slice(0, 10)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
