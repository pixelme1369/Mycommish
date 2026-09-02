"use client";

import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  closeOpenerPeriodAction,
  logOpenerPeriodAsPaidAction,
} from "@/app/admin/openers/actions";
import { Badge } from "@/components/ui/badge";

export function OpenerPeriodLockBar({
  monthLabel,
  closed,
  paid,
}: {
  monthLabel: string;
  closed: boolean;
  paid: boolean;
}) {
  const router = useRouter();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {paid ? (
        <Badge variant="secondary" className="font-normal uppercase tracking-wide">
          Paid
        </Badge>
      ) : closed ? (
        <Badge variant="outline" className="font-normal uppercase tracking-wide">
          Closed
        </Badge>
      ) : (
        <Badge variant="outline" className="font-normal uppercase tracking-wide">
          Open
        </Badge>
      )}
      {!closed && !paid ? (
        <ConfirmDelete
          title={`Close ${monthLabel}?`}
          description="Openers cannot add or edit files. Upscore and pay status are locked. Forth can still refresh CRM stage/status."
          triggerLabel="Close period"
          confirmLabel="Yes, close period"
          triggerVariant="ghost"
          onConfirm={async () => {
            const res = await closeOpenerPeriodAction(monthLabel);
            if (!res.ok) throw new Error(res.error);
            router.refresh();
          }}
        />
      ) : null}
      {!paid ? (
        <ConfirmDelete
          title={`Log ${monthLabel} as paid?`}
          description="Saves a paid snapshot of every opener file and upscore for this month, then locks the period."
          triggerLabel="Log as paid"
          confirmLabel="Yes, log as paid"
          pendingLabel="Logging…"
          triggerVariant="outline"
          triggerSize="sm"
          onConfirm={async () => {
            const res = await logOpenerPeriodAsPaidAction(monthLabel);
            if (!res.ok) throw new Error(res.error);
            router.refresh();
          }}
        />
      ) : (
        <span className="text-sm text-muted-foreground">Saved as paid</span>
      )}
    </div>
  );
}
