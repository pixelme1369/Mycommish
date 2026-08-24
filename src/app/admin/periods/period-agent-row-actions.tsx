"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MoreActionsMenu, menuItemClass } from "@/components/more-actions-menu";
import { dismissSalesRepAction } from "@/app/admin/dismissal-actions";
import { ReinstateSalesRepButton } from "@/app/admin/dismiss-buttons";
import { excludeAgentFromPeriodAction } from "@/app/admin/period-exclusion-actions";
import { ReinstatePeriodAgentButton } from "@/app/admin/period-exclusion-buttons";

export function PeriodAgentRowActions({
  periodId,
  periodLabel,
  agentPeriodId,
  agentName,
  dismissed,
  excluded = false,
  readOnly = false,
}: {
  periodId: string;
  periodLabel: string;
  agentPeriodId: string;
  agentName: string;
  dismissed?: boolean;
  /** Removed from this period’s pay only (not global dismiss). */
  excluded?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);

  if (dismissed) {
    if (readOnly) return null;
    return (
      <div className="flex justify-end">
        <ReinstateSalesRepButton agentName={agentName} />
      </div>
    );
  }

  if (excluded) {
    if (readOnly) return null;
    return (
      <div className="flex justify-end">
        <ReinstatePeriodAgentButton
          periodId={periodId}
          periodLabel={periodLabel}
          agentName={agentName}
        />
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <MoreActionsMenu label="More actions" estimatedHeight={220} menuWidth={220}>
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
                setExcludeOpen(true);
              }}
            >
              Remove from this period
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass(true)}
              onClick={() => {
                close();
                setDismissOpen(true);
              }}
            >
              Dismiss everywhere
            </button>
          </>
        )}
      </MoreActionsMenu>

      <ConfirmDelete
        hideTrigger
        open={excludeOpen}
        onOpenChange={setExcludeOpen}
        title={`Remove ${agentName} from ${periodLabel}?`}
        description={`${agentName} will be hidden from this period’s pay list, Gusto, and exports only. Other months are unchanged. Survives CRM re-upload — you can restore them later.`}
        confirmLabel="Remove from period"
        pendingLabel="Removing…"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("agentName", agentName);
          fd.set("periodLabel", periodLabel);
          fd.set("periodId", periodId);
          await excludeAgentFromPeriodAction(fd);
          router.refresh();
        }}
      />

      <ConfirmDelete
        hideTrigger
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={`Dismiss ${agentName} everywhere?`}
        description={`${agentName} will be hidden from all commission period lists, the agent portal, and Gusto export. Past ledger data is kept for audit. You can reinstate them later from Manage Agents.`}
        confirmLabel="Dismiss everywhere"
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
