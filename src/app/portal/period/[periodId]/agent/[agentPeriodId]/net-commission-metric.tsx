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
import { ALEX_DIRECTOR_OVERRIDE_BANDS } from "@/lib/commission/director-plan";

function money(n: number | undefined) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function num(n: number | undefined) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export type DirectorTierSlice = {
  label: string;
  files: number;
  rate: number;
  amount: number;
};

export type NetCommissionBreakdown = {
  net: number;
  gross: number;
  clawback: number;
  manualBonus: number;
  teamLeadBonus: number;
  directorOverride: number;
  advancePaid: number;
  advanceRepay: number;
  directorPlan?: boolean;
  /** Company units used for Director bands (period Units cleared). */
  companyUnits?: number;
  /** Active band slices that earned dollars this period. */
  directorSlices?: DirectorTierSlice[];
  penaltyApplied?: boolean;
};

type Line = {
  key: string;
  label: string;
  amount: number;
  sign: "+" | "−" | "=";
};

function buildStandardLines(b: NetCommissionBreakdown): Line[] {
  const lines: Line[] = [
    { key: "gross", label: "Gross commission", amount: num(b.gross), sign: "+" },
  ];
  if (num(b.clawback) > 0) {
    lines.push({ key: "clawback", label: "Clawbacks", amount: num(b.clawback), sign: "−" });
  }
  if (num(b.manualBonus) > 0) {
    lines.push({ key: "manual", label: "Manual bonus", amount: num(b.manualBonus), sign: "+" });
  }
  if (num(b.teamLeadBonus) > 0) {
    lines.push({
      key: "tlb",
      label: "Team lead bonus",
      amount: num(b.teamLeadBonus),
      sign: "+",
    });
  }
  if (num(b.advancePaid) > 0) {
    lines.push({
      key: "advPaid",
      label: "Advance paid",
      amount: num(b.advancePaid),
      sign: "+",
    });
  }
  if (num(b.advanceRepay) > 0) {
    lines.push({
      key: "advRepay",
      label: "Advance repayment",
      amount: num(b.advanceRepay),
      sign: "−",
    });
  }
  lines.push({ key: "net", label: "Net", amount: num(b.net), sign: "=" });
  return lines;
}

function bandRangeLabel(low: number, high: number | null): string {
  if (high == null) return `${low.toLocaleString("en-US")}+`;
  return `${low.toLocaleString("en-US")}–${high.toLocaleString("en-US")}`;
}

function DirectorTierBreakdown({
  breakdown,
}: {
  breakdown: NetCommissionBreakdown;
}) {
  const companyUnits = num(breakdown.companyUnits);
  const slices = breakdown.directorSlices ?? [];
  const earnedByLabel = new Map(slices.map((s) => [s.label, s]));
  const overrideTotal =
    slices.reduce((s, x) => s + num(x.amount), 0) || num(breakdown.directorOverride);
  const rate = breakdown.penaltyApplied
    ? (b: (typeof ALEX_DIRECTOR_OVERRIDE_BANDS)[number]) => b.reducedRate
    : (b: (typeof ALEX_DIRECTOR_OVERRIDE_BANDS)[number]) => b.rate;

  const equation =
    slices.length === 1
      ? `${slices[0].files.toLocaleString("en-US")} × $${rateLabel(slices[0].rate)} = ${money(slices[0].amount)}`
      : slices.length > 1
        ? `${slices.map((s) => `${s.files.toLocaleString("en-US")}×$${rateLabel(s.rate)}`).join(" + ")} = ${money(overrideTotal)}`
        : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-muted/40 px-3 py-2.5">
        <p className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
          Company units this period
        </p>
        <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
          {companyUnits.toLocaleString("en-US")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Same total as the period’s Units cleared (active agents only).
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
          Director bands (marginal)
        </p>
        <ul className="overflow-hidden rounded-lg ring-1 ring-border/70 divide-y divide-border/70">
          {ALEX_DIRECTOR_OVERRIDE_BANDS.map((band) => {
            const earned = earnedByLabel.get(band.label);
            const active = Boolean(earned && earned.files > 0);
            const displayRate = rate(band);
            return (
              <li
                key={band.label}
                className={cn(
                  "px-3 py-2.5",
                  active ? "bg-background" : "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {band.label}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        files {bandRangeLabel(band.low, band.high)}
                      </span>
                    </p>
                    {active && earned ? (
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {earned.files.toLocaleString("en-US")} files × $
                        {rateLabel(earned.rate)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs tabular-nums">
                        ${rateLabel(displayRate)} / file · not reached
                      </p>
                    )}
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {active && earned ? money(earned.amount) : "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {breakdown.penaltyApplied ? (
          <p className="mt-2 text-xs text-amber-800">
            Personal cancel rate over 25% — each band is $5 lower this month.
          </p>
        ) : null}
      </div>

      {equation ? (
        <p className="rounded-lg ring-1 ring-border/70 px-3 py-2.5 text-center text-sm font-medium tabular-nums text-foreground">
          {equation}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <span className="text-sm font-medium text-foreground">Your net</span>
        <span className="text-base font-semibold tabular-nums text-money">
          {money(breakdown.net)}
        </span>
      </div>
    </div>
  );
}

function rateLabel(rate: number) {
  return num(rate).toFixed(2).replace(/\.00$/, "");
}

export function NetCommissionMetric({
  breakdown,
}: {
  breakdown: NetCommissionBreakdown;
}) {
  const [open, setOpen] = useState(false);
  const directorMode = Boolean(breakdown.directorPlan);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(
          "w-full bg-primary/10 px-3 py-2.5 text-left transition-colors",
          "hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <p className="text-[10px] font-medium tracking-wider uppercase text-money">
          Net
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-money underline decoration-dotted decoration-money/50 underline-offset-2">
          {money(breakdown.net)}
        </p>
      </AlertDialogTrigger>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {directorMode ? "How your net was calculated" : "Net commission"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {directorMode
              ? "Company cleared units, priced through your Director bands. Personal files are house deals and do not add to this number."
              : "How this period’s net was calculated."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {directorMode ? (
          <DirectorTierBreakdown breakdown={breakdown} />
        ) : (
          <ul className="rounded-lg ring-1 ring-border/70 divide-y divide-border/70 text-sm">
            {buildStandardLines(breakdown).map((line) => (
              <li
                key={line.key}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  line.sign === "=" && "bg-muted/40 font-medium",
                )}
              >
                <span className="min-w-0 truncate">
                  {line.sign === "=" ? "" : `${line.sign} `}
                  {line.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    line.sign === "−" && "text-destructive",
                    line.sign === "=" && "text-money",
                  )}
                >
                  {line.sign === "−"
                    ? `−${money(line.amount)}`
                    : money(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel variant="default">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
