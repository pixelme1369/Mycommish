"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  formatOpenerPayDate,
  formatOpenerPeriodName,
} from "@/lib/opener/payout";

export function parseOpenerMonthParam(
  raw: string | undefined,
  fallback: string,
): string {
  return /^\d{4}-\d{2}$/.test(raw || "") ? (raw as string) : fallback;
}

function optionLabel(periodLabel: string) {
  return `${formatOpenerPeriodName(periodLabel)} · Pay ${formatOpenerPayDate(periodLabel)}`;
}

/** Compact pay-period dropdown (same YYYY-MM and payday as agents). */
export function OpenerPeriodPicker({
  periods,
  selected,
  pathname,
  stats,
}: {
  periods: string[];
  selected: string;
  pathname: string;
  stats?: ReactNode;
}) {
  const router = useRouter();

  if (!periods.length) {
    return (
      <p className="mb-4 text-sm text-muted-foreground">No pay periods yet.</p>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="space-y-1.5">
        <Label htmlFor="opener-pay-period" className="text-muted-foreground">
          Pay period
        </Label>
        <select
          id="opener-pay-period"
          value={selected}
          onChange={(e) => {
            const next = e.target.value;
            if (!next || next === selected) return;
            router.push(`${pathname}?month=${encodeURIComponent(next)}`);
          }}
          className="flex h-9 min-w-[18rem] rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {periods.map((label) => (
            <option key={label} value={label}>
              {optionLabel(label)}
            </option>
          ))}
        </select>
      </div>
      {stats}
    </div>
  );
}
