"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteHistoryPeriodAction } from "./actions";

export function DeleteHistoryPeriodButton({
  periodId,
  periodLabel,
  redirectTo,
}: {
  periodId: string;
  periodLabel: string;
  /** After delete, navigate here (e.g. `/admin` from a detail page). */
  redirectTo?: string;
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
            `Delete history period ${periodLabel}? You can re-import that month afterward.`,
          )
        ) {
          return;
        }
        start(async () => {
          const res = await deleteHistoryPeriodAction(periodId);
          if (!res.ok) {
            alert(res.error);
            return;
          }
          if (redirectTo) {
            router.push(redirectTo);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
