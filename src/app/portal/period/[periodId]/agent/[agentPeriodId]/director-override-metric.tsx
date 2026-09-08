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
import type { DirectorOverrideBreakdown } from "@/lib/ingest/director-override";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function DirectorOverrideMetric({
  breakdown,
}: {
  breakdown: DirectorOverrideBreakdown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(
          "w-full bg-background px-3 py-2.5 text-left transition-colors",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <p className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
          Director override
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground underline decoration-dotted decoration-muted-foreground/80 underline-offset-2">
          +{money(breakdown.amount)}
        </p>
      </AlertDialogTrigger>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Director override</AlertDialogTitle>
          <AlertDialogDescription>
            Same company “Units cleared” total as this pay period (excluding
            dismissed, openers, and period-excluded agents), priced marginally by
            band. Personal files are house deals.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <p className="font-medium tabular-nums text-foreground">
            {breakdown.companyFiles.toLocaleString("en-US")} files →{" "}
            {money(breakdown.amount)}
            {breakdown.penaltyApplied ? (
              <span className="ml-2 text-xs font-normal text-amber-800">
                −$5/file (personal cancel &gt; 25%)
              </span>
            ) : null}
          </p>
          {breakdown.slices.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto rounded-lg ring-1 ring-border/70 divide-y divide-border/70">
              {breakdown.slices.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0 truncate">
                    {s.label}: {s.files.toLocaleString("en-US")} × $
                    {s.rate.toFixed(2).replace(/\.00$/, "")}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {money(s.amount)}
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
