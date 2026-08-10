"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { closeCalculatedPeriodAction } from "./actions";

export function ClosePeriodButton({
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
      className="text-xs font-medium text-zinc-700 hover:underline disabled:opacity-50"
      onClick={() => {
        if (
          !confirm(
            `Close ${periodLabel}? New CRM units/gross for this month will be blocked. Clawbacks can still land.`,
          )
        ) {
          return;
        }
        start(async () => {
          const res = await closeCalculatedPeriodAction(periodId);
          if (!res.ok) {
            alert(res.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Closing…" : "Close"}
    </button>
  );
}
