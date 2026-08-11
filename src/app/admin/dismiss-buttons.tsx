"use client";

import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { dismissSalesRepAction, reinstateSalesRepAction } from "@/app/admin/dismissal-actions";
import { cn } from "@/lib/utils";

export function DismissSalesRepButton({
  agentName,
  triggerClassName,
}: {
  agentName: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDelete
      title={`Dismiss ${agentName}?`}
      description={`${agentName} will be hidden from commission period lists, the agent portal, and Gusto export. Past ledger data is kept for audit. You can reinstate them later from Manage Agents.`}
      triggerLabel="Dismiss"
      confirmLabel="Dismiss"
      pendingLabel="Dismissing…"
      triggerVariant="ghost"
      triggerSize="sm"
      triggerClassName={cn(
        "h-auto w-full justify-start px-2 py-1.5 text-sm font-normal text-destructive hover:bg-muted hover:text-destructive",
        triggerClassName,
      )}
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("agentName", agentName);
        await dismissSalesRepAction(fd);
        router.refresh();
      }}
    />
  );
}

export function ReinstateSalesRepButton({ agentName }: { agentName: string }) {
  const router = useRouter();
  return (
    <ConfirmDelete
      title={`Reinstate ${agentName}?`}
      description={`${agentName} will show again on commission periods, portal, and Gusto export.`}
      triggerLabel="Reinstate"
      confirmLabel="Reinstate"
      pendingLabel="Reinstating…"
      triggerVariant="outline"
      triggerSize="sm"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("agentName", agentName);
        await reinstateSalesRepAction(fd);
        router.refresh();
      }}
    />
  );
}
