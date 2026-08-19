import { Badge } from "@/components/ui/badge";
import { isWeekendPaidOn } from "@/lib/manager-bonus-dates";
import { cn } from "@/lib/utils";

/** Paid-on date; weekends get a clear amber “Weekend” marker. */
export function PaidOnDate({
  date,
  includeYear = true,
  className,
}: {
  date: Date | string;
  includeYear?: boolean;
  className?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  const weekend = isWeekendPaidOn(d);
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn("tabular-nums", weekend && "font-medium text-amber-800")}>
        {label}
      </span>
      {weekend ? (
        <Badge
          variant="outline"
          className="h-5 border-amber-300/80 bg-amber-50 text-[10px] font-medium tracking-wide text-amber-800 uppercase"
        >
          Weekend
        </Badge>
      ) : null}
    </span>
  );
}
