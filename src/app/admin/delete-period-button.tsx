"use client";

import { useRouter } from "next/navigation";
import { deleteCalculatedPeriodAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function DeletePeriodButton({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Delete ${periodLabel}?`}
      description={`This permanently removes the calculated period ${periodLabel} and every agent/client/ledger row in it. You can re-upload the CRM afterward. This cannot be undone.`}
      triggerLabel="Delete"
      confirmLabel="Yes, delete period"
      onConfirm={async () => {
        const res = await deleteCalculatedPeriodAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.push("/admin");
        router.refresh();
      }}
    />
  );
}
