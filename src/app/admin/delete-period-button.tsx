"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteCalculatedPeriodAction } from "./actions";

export function DeletePeriodButton({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
      onClick={() => {
        if (
          !confirm(
            `Delete calculated period ${periodLabel}? You can re-upload the CRM afterward.`,
          )
        ) {
          return;
        }
        start(async () => {
          const res = await deleteCalculatedPeriodAction(periodId);
          if (!res.ok) {
            alert(res.error);
            return;
          }
          router.push("/admin");
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
