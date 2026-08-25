import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Agent-facing pay status:
 * - Paid: admin logged the month as paid (History)
 * - Pending payout: statement fully signed, not yet logged as paid
 */
export function PeriodPayStatusChip({
  paid,
  pendingPayout,
  className,
}: {
  paid: boolean;
  pendingPayout: boolean;
  className?: string;
}) {
  if (paid) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "font-normal text-[10px] uppercase tracking-wide",
          className,
        )}
      >
        Paid
      </Badge>
    );
  }
  if (pendingPayout) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-normal text-[10px] uppercase tracking-wide text-muted-foreground",
          className,
        )}
      >
        Pending payout
      </Badge>
    );
  }
  return null;
}
