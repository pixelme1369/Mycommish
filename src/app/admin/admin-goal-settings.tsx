"use client";

import { useActionState } from "react";
import {
  saveGoalClearRateAction,
  type SaveGoalSettingsResult,
} from "@/app/admin/goal-settings-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminGoalSettings({ clearRatePct }: { clearRatePct: number }) {
  const [state, action, pending] = useActionState(
    saveGoalClearRateAction,
    null as SaveGoalSettingsResult | null,
  );

  return (
    <section>
      <div>
        <h2 className="font-heading text-base tracking-tight">Goals</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Paycheck estimate
        </p>
      </div>
      <Card className="glass-panel mt-4 p-4 sm:p-5">
        <form key={clearRatePct} action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-clear-rate" className="text-muted-foreground">
              Clear rate %
            </Label>
            <Input
              id="admin-clear-rate"
              name="clearRate"
              inputMode="decimal"
              defaultValue={String(clearRatePct)}
              placeholder="70"
              className="h-9 w-28 tabular-nums"
              aria-label="Company-wide goal clear rate percent"
            />
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state?.ok ? (
            <p className="text-sm text-emerald-700" role="status">
              Saved — agents will see this on Goals.
            </p>
          ) : null}
          {state && !state.ok ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </form>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Share of enrolled $ / units expected to clear into commission. Agents
          cannot change this.
        </p>
      </Card>
    </section>
  );
}
