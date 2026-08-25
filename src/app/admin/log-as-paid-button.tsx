"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { promoteCalculatedPeriodToHistoryAction } from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogAsPaidButton({
  periodId,
  periodLabel,
  historyPeriodId,
  menu,
}: {
  periodId: string;
  periodLabel: string;
  /** When set, History already exists — link to that archive instead of promoting. */
  historyPeriodId?: string | null;
  menu?: boolean;
}) {
  const router = useRouter();

  if (historyPeriodId) {
    if (menu) {
      return (
        <Link
          href={`/admin/history/${historyPeriodId}`}
          role="menuitem"
          className="block h-auto w-full rounded-none px-3 py-1.5 text-left text-sm font-normal hover:bg-muted"
        >
          View paid History
        </Link>
      );
    }
    return (
      <Link
        href={`/admin/history/${historyPeriodId}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        View paid History
      </Link>
    );
  }

  return (
    <ConfirmDelete
      title={`Log ${periodLabel} as paid?`}
      description={`Creates a History archive of every paid/clawback file for ${periodLabel} for active agents only (skips dismissed/excluded — same set as the pay dashboard). Exact per-file commissions + rates. Does not change calculated pay.`}
      triggerLabel="Log as paid"
      confirmLabel="Yes, log as paid"
      pendingLabel="Logging…"
      triggerVariant={menu ? "ghost" : "outline"}
      triggerSize="sm"
      triggerClassName={
        menu
          ? "h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal hover:bg-muted"
          : undefined
      }
      onConfirm={async () => {
        const res = await promoteCalculatedPeriodToHistoryAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.push(`/admin/history/${res.historyPeriodId}`);
        router.refresh();
      }}
    />
  );
}

/** Controlled confirm used from period row menus (trigger lives in the menu). */
export function LogAsPaidConfirm({
  periodId,
  periodLabel,
  open,
  onOpenChange,
}: {
  periodId: string;
  periodLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <ConfirmDelete
      hideTrigger
      open={open}
      onOpenChange={onOpenChange}
      title={`Log ${periodLabel} as paid?`}
      description={`Creates a History archive of every paid/clawback file for ${periodLabel} for active agents only (skips dismissed/excluded — same set as the pay dashboard). Exact per-file commissions + rates. Does not change calculated pay.`}
      confirmLabel="Yes, log as paid"
      pendingLabel="Logging…"
      onConfirm={async () => {
        const res = await promoteCalculatedPeriodToHistoryAction(periodId);
        if (!res.ok) throw new Error(res.error);
        router.push(`/admin/history/${res.historyPeriodId}`);
        router.refresh();
      }}
    />
  );
}
