"use client";

import { cn } from "@/lib/utils";
import { money } from "@/lib/format";

export type NextTierCardProps = {
  agentName?: string;
  periodLabel?: string;
  unitsNeeded: number | null;
  gain: number | null;
  atTopTier?: boolean;
  fixedRate?: boolean;
  className?: string;
};

export function NextTierCard({
  agentName,
  periodLabel,
  unitsNeeded,
  gain,
  atTopTier,
  fixedRate,
  className,
}: NextTierCardProps) {
  const hot = unitsNeeded != null && unitsNeeded <= 3;

  let value: string;
  if (unitsNeeded == null) {
    value = atTopTier ? "Top tier" : fixedRate ? "Fixed rate" : "—";
  } else {
    value = String(unitsNeeded);
  }

  let detail: string | null = null;
  if (unitsNeeded != null && gain != null && gain > 0) {
    detail = `+${money(gain)} at next rate`;
  } else if (unitsNeeded == null && atTopTier) {
    detail = "Highest ladder step";
  } else if (unitsNeeded == null && fixedRate) {
    detail = "Contract override";
  }

  return (
    <div
      className={cn(
        "glass-panel rounded-lg border border-border/80 px-4 py-3",
        hot && "ring-1 ring-[oklch(0.75_0.08_75/0.5)]",
        className,
      )}
      title={
        unitsNeeded != null
          ? "Illustrative: same cleared debt at the next tier rate. Extra units also add debt."
          : undefined
      }
    >
      {(agentName || periodLabel) && (
        <p className="mb-1 truncate text-[11px] text-muted-foreground">
          {[periodLabel, agentName].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        To next tier
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-medium tabular-nums",
          hot && "text-[oklch(0.42_0.1_55)]",
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{detail}</p>
      ) : null}
    </div>
  );
}
