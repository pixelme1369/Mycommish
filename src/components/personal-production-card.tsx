import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import type { PersonalProductionProgress } from "@/lib/commission/director-plan";

function moneyShort(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1000)}k`;
  }
  return money(n);
}

/** Director personal-production KPI — house deals toward the monthly $1.25M expectation. */
export function PersonalProductionCard({
  progress,
  className,
}: {
  progress: PersonalProductionProgress;
  className?: string;
}) {
  const push = !progress.met;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background px-3 py-2.5",
        push ? "border-amber-500/50 bg-amber-50/40" : "border-primary/50",
        className,
      )}
      title="Personal surviving cleared debt this month. House deals — $0 commission; needed for the Director production expectation."
    >
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Personal production
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tracking-tight tabular-nums",
          push ? "text-amber-900" : "text-money",
        )}
      >
        {progress.met ? "Met" : moneyShort(progress.remaining)}
      </p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {progress.met
          ? `${moneyShort(progress.cleared)} of ${moneyShort(progress.target)}`
          : `to ${moneyShort(progress.target)} · ${moneyShort(progress.cleared)} cleared`}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            push ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${Math.max(progress.pct, progress.cleared > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
        {progress.pct}% of {moneyShort(progress.target)}
      </p>
    </div>
  );
}
