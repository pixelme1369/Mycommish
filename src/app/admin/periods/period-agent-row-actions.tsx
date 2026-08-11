"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MoreActionsMenu, menuItemClass } from "@/components/more-actions-menu";
import { dismissSalesRepAction } from "@/app/admin/dismissal-actions";
import { ReinstateSalesRepButton } from "@/app/admin/dismiss-buttons";

export function PeriodAgentRowActions({
  periodId,
  agentPeriodId,
  agentName,
  dismissed,
}: {
  periodId: string;
  agentPeriodId: string;
  agentName: string;
  dismissed?: boolean;
}) {
  const router = useRouter();
  const [dismissOpen, setDismissOpen] = useState(false);

  if (dismissed) {
    return (
      <div className="flex justify-end">
        <ReinstateSalesRepButton agentName={agentName} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/portal/period/${periodId}/agent/${agentPeriodId}`}
        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
      >
        View
      </Link>
      <MoreActionsMenu label="More actions" estimatedHeight={120} menuWidth={168}>
        {(close) => (
          <>
            <a
              role="menuitem"
              href={`/api/admin/periods/${periodId}/agents/${agentPeriodId}/statement`}
              className={menuItemClass()}
              onClick={close}
            >
              Statement PDF
            </a>
            <a
              role="menuitem"
              href={`/api/admin/periods/${periodId}/agents/${agentPeriodId}/export`}
              className={menuItemClass()}
              onClick={close}
            >
              Excel
            </a>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              className={menuItemClass(true)}
              onClick={() => {
                close();
                setDismissOpen(true);
              }}
            >
              Dismiss
            </button>
          </>
        )}
      </MoreActionsMenu>

      <ConfirmDelete
        hideTrigger
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={`Dismiss ${agentName}?`}
        description={`${agentName} will be hidden from commission period lists, the agent portal, and Gusto export. Past ledger data is kept for audit. You can reinstate them later from Manage Agents.`}
        confirmLabel="Dismiss"
        pendingLabel="Dismissing…"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("agentName", agentName);
          await dismissSalesRepAction(fd);
          router.refresh();
        }}
      />
    </div>
  );
}
