"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { approveManualBonusAction } from "@/app/portal/period/[periodId]/agent/[agentPeriodId]/manual-bonus-actions";

export function ApproveManualBonusButton({
  bonusId,
  agentName,
  periodLabel,
  amount,
}: {
  bonusId: string;
  agentName: string;
  periodLabel: string;
  amount: number;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      action={(formData) => {
        const ok = window.confirm(
          `Approve manual bonus?\n\n${agentName} · ${periodLabel} · ${money(amount)}\n\nThis adds the amount to net commission.`,
        );
        if (!ok) return;
        start(() => {
          void approveManualBonusAction(formData);
        });
      }}
    >
      <input type="hidden" name="bonusId" value={bonusId} />
      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? "Approving…" : "Approve"}
      </Button>
    </form>
  );
}
