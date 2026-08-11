"use client";

import { useRouter } from "next/navigation";
import { deleteHistoryPeriodAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function DeleteHistoryPeriodButton({
  periodId,
  periodLabel,
  redirectTo,
  menu,
}: {
  periodId: string;
  periodLabel: string;
  redirectTo?: string;
  menu?: boolean;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Delete history ${periodLabel}?`}
      description={`This permanently removes the history period ${periodLabel} and every agent/client/ledger row in it. You can re-import that month afterward. This cannot be undone.`}
      triggerLabel="Delete period"
      confirmLabel="Yes, delete history"
      triggerVariant={menu ? "ghost" : "destructive"}
      triggerClassName={
        menu
          ? "h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal text-destructive hover:bg-muted hover:text-destructive"
          : undefined
      }
      onConfirm={async () => {
        const res = await deleteHistoryPeriodAction(periodId);
        if (!res.ok) throw new Error(res.error);
        if (redirectTo) {
          router.push(redirectTo);
          return;
        }
        router.refresh();
      }}
    />
  );
}
