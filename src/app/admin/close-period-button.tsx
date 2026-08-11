"use client";

import { useRouter } from "next/navigation";
import { closeCalculatedPeriodAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function ClosePeriodButton({
  periodId,
  periodLabel,
  menu,
}: {
  periodId: string;
  periodLabel: string;
  menu?: boolean;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Close ${periodLabel}?`}
      description={`New CRM units/gross for ${periodLabel} will be blocked. Clawbacks can still land. You can still delete the period later if needed.`}
      triggerLabel="Close period"
      confirmLabel="Yes, close period"
      triggerVariant="ghost"
      triggerClassName={
        menu
          ? "h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal hover:bg-muted"
          : undefined
      }
      onConfirm={async () => {
        const res = await closeCalculatedPeriodAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      }}
    />
  );
}
