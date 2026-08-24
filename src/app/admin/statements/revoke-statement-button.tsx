"use client";

import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { resetStatementSignaturesAction } from "@/app/portal/period/[periodId]/agent/[agentPeriodId]/statement-actions";

export function RevokeStatementButton({
  periodId,
  agentPeriodId,
  agentName,
  periodLabel,
}: {
  periodId: string;
  agentPeriodId: string;
  agentName: string;
  periodLabel: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Revoke ${agentName} · ${periodLabel}?`}
      description="Clears agent and manager signatures. This statement leaves the signed list until both sign again."
      triggerLabel="Revoke"
      confirmLabel="Yes, revoke signatures"
      pendingLabel="Revoking…"
      triggerVariant="outline"
      triggerSize="sm"
      triggerClassName="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onConfirm={async () => {
        const res = await resetStatementSignaturesAction({ periodId, agentPeriodId });
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      }}
    />
  );
}
