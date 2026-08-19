"use client";

import { useActionState, useState } from "react";
import { createManagerBonusAction, type BonusFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { periodLabelForNextPayDate } from "@/lib/manager-bonus-dates";
import { paymentDateForPeriod } from "@/lib/commission/calculator";

const initial: BonusFormState = null;

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function payDateLabel(periodLabel: string): string {
  return paymentDateForPeriod(periodLabel).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LogBonusForm({
  agents,
}: {
  agents: Array<{ id: string; displayName: string }>;
}) {
  const [state, action, pending] = useActionState(createManagerBonusAction, initial);
  const [paidOn, setPaidOn] = useState(todayLocalYmd);
  const periodLabel = periodLabelForNextPayDate();

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recipientAgentId">Agent</Label>
          <select
            id="recipientAgentId"
            name="recipientAgentId"
            required
            defaultValue=""
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="" disabled>
              Select agent…
            </option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="200.00"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          name="reason"
          required
          placeholder="e.g. Biggest Debt Deal enrolled"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="paidOn">Paid on</Label>
          <Input
            id="paidOn"
            name="paidOn"
            type="date"
            required
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Commission period</Label>
          <p className="border-input bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm font-medium tabular-nums">
            {periodLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Always the next payday ({payDateLabel(periodLabel)}). Rolls automatically after that
            date.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={pending || agents.length === 0} size="sm">
        {pending ? "Saving…" : "Log payout"}
      </Button>

      {state?.ok === false ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t save</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === true ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
