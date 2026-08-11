"use client";

import { useRouter } from "next/navigation";
import { deleteCalculatedPeriodAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function DeletePeriodButton({
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
      title={`Delete ${periodLabel}?`}
      description={`This permanently removes the calculated period ${periodLabel} and every agent/client/ledger row in it. You can re-upload the CRM afterward. This cannot be undone.`}
      triggerLabel="Delete period"
      confirmLabel="Yes, delete period"
      triggerVariant={menu ? "ghost" : "destructive"}
      triggerClassName={
        menu
          ? "h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal text-destructive hover:bg-muted hover:text-destructive"
          : undefined
      }
      onConfirm={async () => {
        const res = await deleteCalculatedPeriodAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.push("/admin");
        router.refresh();
      }}
    />
  );
}
