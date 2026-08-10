"use client";

import { useRouter } from "next/navigation";
import { closeCalculatedPeriodAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function ClosePeriodButton({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Close ${periodLabel}?`}
      description={`New CRM units/gross for ${periodLabel} will be blocked. Clawbacks can still land. You can still delete the period later if needed.`}
      triggerLabel="Close"
      confirmLabel="Yes, close period"
      triggerVariant="outline"
      onConfirm={async () => {
        const res = await closeCalculatedPeriodAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      }}
    />
  );
}
