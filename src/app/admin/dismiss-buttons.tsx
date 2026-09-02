"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DismissLastCheckDialog } from "@/app/admin/last-check-dialog";
import { reinstateSalesRepAction } from "@/app/admin/dismissal-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DismissSalesRepButton({
  agentName,
  agentPeriodId,
  triggerClassName,
}: {
  agentName: string;
  agentPeriodId?: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto w-full justify-start px-2 py-1.5 text-sm font-normal text-destructive hover:bg-muted hover:text-destructive",
          triggerClassName,
        )}
        onClick={() => setOpen(true)}
      >
        Dismiss
      </Button>
      <DismissLastCheckDialog
        open={open}
        onOpenChange={setOpen}
        agentName={agentName}
        agentPeriodId={agentPeriodId}
      />
    </>
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
