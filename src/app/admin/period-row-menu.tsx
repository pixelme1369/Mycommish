"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MoreActionsMenu, menuItemClass } from "@/components/more-actions-menu";
import { closeCalculatedPeriodAction } from "./actions";
import { deleteCalculatedPeriodAction } from "./actions";
import { deleteHistoryPeriodAction } from "./actions";
import { LogAsPaidConfirm } from "./log-as-paid-button";

export function CalculatedPeriodRowMenu({
  periodId,
  periodLabel,
  status,
  historyPeriodId,
}: {
  periodId: string;
  periodLabel: string;
  status: string;
  historyPeriodId?: string | null;
}) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <MoreActionsMenu
        label="Period actions"
        estimatedHeight={status === "open" ? 120 : 88}
      >
        {(close) => (
          <>
            {historyPeriodId ? (
              <Link
                href={`/admin/history/${historyPeriodId}`}
                role="menuitem"
                className={menuItemClass()}
                onClick={() => close()}
              >
                View paid History
              </Link>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                onClick={() => {
                  close();
                  setLogOpen(true);
                }}
              >
                Log as paid
              </button>
            )}
            {status === "open" ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                onClick={() => {
                  close();
                  setCloseOpen(true);
                }}
              >
                Close period
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={menuItemClass(true)}
              onClick={() => {
                close();
                setDeleteOpen(true);
              }}
            >
              Delete period
            </button>
          </>
        )}
      </MoreActionsMenu>

      <LogAsPaidConfirm
        periodId={periodId}
        periodLabel={periodLabel}
        open={logOpen}
        onOpenChange={setLogOpen}
      />
      <ConfirmDelete
        hideTrigger
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`Close ${periodLabel}?`}
        description={`New CRM units/gross for ${periodLabel} will be blocked. Clawbacks can still land.`}
        confirmLabel="Yes, close period"
        onConfirm={async () => {
          const res = await closeCalculatedPeriodAction(periodId);
          if (!res.ok) throw new Error(res.error);
          router.refresh();
        }}
      />
      <ConfirmDelete
        hideTrigger
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${periodLabel}?`}
        description={`This permanently removes the calculated period ${periodLabel} and every agent/client/ledger row in it. This cannot be undone.`}
        confirmLabel="Yes, delete period"
        onConfirm={async () => {
          const res = await deleteCalculatedPeriodAction(periodId);
          if (!res.ok) throw new Error(res.error);
          router.refresh();
        }}
      />
    </>
  );
}

export function HistoryPeriodRowMenu({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <MoreActionsMenu label="Period actions" estimatedHeight={44}>
        {(close) => (
          <button
            type="button"
            role="menuitem"
            className={menuItemClass(true)}
            onClick={() => {
              close();
              setDeleteOpen(true);
            }}
          >
            Delete period
          </button>
        )}
      </MoreActionsMenu>

      <ConfirmDelete
        hideTrigger
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete history ${periodLabel}?`}
        description={`This permanently removes the history period ${periodLabel} and every agent/client/ledger row in it. This cannot be undone.`}
        confirmLabel="Yes, delete history"
        onConfirm={async () => {
          const res = await deleteHistoryPeriodAction(periodId);
          if (!res.ok) throw new Error(res.error);
          router.refresh();
        }}
      />
    </>
  );
}
