"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { money, ratePercent } from "@/lib/format";
import {
  dismissSalesRepAction,
  previewLastCheckAction,
  resolveLastCheckPeriodAction,
} from "@/app/admin/dismissal-actions";
import type { LastCheckPreview } from "@/lib/agents/last-check-load";

export function DismissLastCheckDialog({
  open,
  onOpenChange,
  agentName,
  agentPeriodId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  agentPeriodId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<LastCheckPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const name = agentName.trim();
    if (!name) return;
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    (async () => {
      const id =
        (await resolveLastCheckPeriodAction(name)) ||
        agentPeriodId?.trim() ||
        "";
      const next = id ? await previewLastCheckAction(id) : null;
      if (!cancelled) {
        setPreview(next);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, agentName, agentPeriodId]);

  function dismiss(payLastCheck: boolean) {
    start(async () => {
      const fd = new FormData();
      fd.set("agentName", agentName);
      const id = preview?.agentPeriodId || agentPeriodId || "";
      if (id) fd.set("agentPeriodId", id);
      await dismissSalesRepAction(fd);
      onOpenChange(false);
      if (payLastCheck && id) {
        router.push(`/admin/last-check/${id}`);
        return;
      }
      router.refresh();
    });
  }

  const hasWork = (preview?.units ?? 0) > 0 || (preview?.clawbackAmount ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Dismiss {agentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They’ll be hidden from commission lists, the portal, and the regular Gusto
            export. Past ledger stays for audit.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Pay a last check?</p>
          {loading ? (
            <p className="mt-1 text-muted-foreground">Loading upcoming commission files…</p>
          ) : preview && hasWork ? (
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p>
                Upcoming periods {preview.periodLabel}:{" "}
                <span className="text-foreground tabular-nums">{preview.units}</span> file
                {preview.units === 1 ? "" : "s"} passed the payment threshold
                {preview.clawbackAmount > 0
                  ? ` · ${money(preview.clawbackAmount)} clawbacks deducted`
                  : ""}
                .
              </p>
              <p>
                {preview.tierLabel}
                {preview.units > 0 && preview.tierRate > 0
                  ? ` · ${ratePercent(preview.tierRate)}`
                  : ""}{" "}
                of {money(preview.enrolledDebt)} enrolled →{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {money(preview.grossCommission)}
                </span>
              </p>
              <p>
                Gusto amount {money(preview.gustoAmount)} (threshold files minus upcoming
                clawbacks).
              </p>
            </div>
          ) : (
            <p className="mt-1 text-muted-foreground">
              No upcoming threshold files or clawbacks. You can still dismiss without a last
              check.
            </p>
          )}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => dismiss(false)}
            >
              {pending ? "Dismissing…" : "No, just dismiss"}
            </Button>
            <Button
              type="button"
              disabled={pending || loading || !hasWork}
              onClick={() => dismiss(true)}
            >
              {pending ? "Opening…" : "Yes, pay last check"}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
