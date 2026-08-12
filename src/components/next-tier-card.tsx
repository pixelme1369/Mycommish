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
  /** Dense cell for metric grids (agent period summary). */
  compact?: boolean;
  className?: string;
};

export function NextTierCard({
  agentName,
  periodLabel,
  unitsNeeded,
  gain,
  atTopTier,
  fixedRate,
  compact,
  className,
}: NextTierCardProps) {
  const actionable = unitsNeeded != null;

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
    detail = "Negotiated rate";
  }

  const title = actionable
    ? "Illustrative: same cleared debt at the next tier rate. Extra units also add debt."
    : undefined;

  if (compact) {
    return (
      <div
        className={cn(
          "bg-background px-3 py-2.5",
          actionable && "bg-primary/10",
          className,
        )}
        title={title}
      >
        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          To next tier
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm font-semibold tabular-nums text-foreground",
            actionable && "text-money",
          )}
        >
          {value}
        </p>
        {detail ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{detail}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-background px-3 py-2.5",
        actionable ? "border-primary/50" : "border-border/80",
        className,
      )}
      title={title}
    >
      {(agentName || periodLabel) && (
        <p className="mb-1 truncate text-[11px] text-muted-foreground">
          {[periodLabel, agentName].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        To next tier
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tracking-tight tabular-nums",
          actionable ? "text-money" : "text-foreground",
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{detail}</p>
      ) : null}
    </div>
  );
}
