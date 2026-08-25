"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { TeamLeadBonusBreakdown } from "@/lib/teams/team-lead-bonus";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function TeamLeadBonusMetric({
  breakdown,
}: {
  breakdown: TeamLeadBonusBreakdown;
}) {
  const [open, setOpen] = useState(false);
  const rateLabel = breakdown.ratePerUnit.toFixed(2).replace(/\.00$/, "");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(
          "w-full bg-background px-3 py-2.5 text-left transition-colors",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <p className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
          Team lead bonus
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground underline decoration-dotted decoration-muted-foreground/80 underline-offset-2">
          +{money(breakdown.amount)}
        </p>
      </AlertDialogTrigger>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Team lead bonus</AlertDialogTitle>
          <AlertDialogDescription>
            How this period’s team-lead bonus was calculated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <p className="font-medium tabular-nums text-foreground">
            {breakdown.teamUnits.toLocaleString("en-US")} units × ${rateLabel} ={" "}
            {money(breakdown.amount)}
          </p>
          <p className="text-xs text-muted-foreground">{breakdown.scopeLabel}</p>
          {breakdown.members.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto rounded-lg ring-1 ring-border/70 divide-y divide-border/70">
              {breakdown.members.map((m) => (
                <li
                  key={m.agentName}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate">{m.agentName}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {m.units} unit{m.units === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel variant="default">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
