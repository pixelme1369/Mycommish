"use client";

import { useActionState, useMemo, useState } from "react";
import { createAdvanceAction, type AdvanceFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { paymentDateForPeriod } from "@/lib/commission/calculator";

const initial: AdvanceFormState = null;

function nextPeriodLabel(yyyyMm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm.trim());
  if (!m) return yyyyMm;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month === 12) return `${y + 1}-01`;
  return `${y}-${String(month + 1).padStart(2, "0")}`;
}

function payLabel(periodLabel: string) {
  try {
    return paymentDateForPeriod(periodLabel).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return periodLabel;
  }
}

export function CreateAdvanceForm({
  agents,
  periodLabels,
}: {
  agents: Array<{
    agentName: string;
    agentId: string;
    displayName: string;
  }>;
  periodLabels: string[];
}) {
  const [state, action, pending] = useActionState(createAdvanceAction, initial);
  const [agentName, setAgentName] = useState(agents[0]?.agentName ?? "");
  // periodLabels are newest-first: pay with older month, deduct from newer.
  const [payWith, setPayWith] = useState(
    periodLabels[1] ?? periodLabels[0] ?? "",
  );
  const [deductFrom, setDeductFrom] = useState(periodLabels[0] ?? "");

  const selected = useMemo(
    () => agents.find((a) => a.agentName === agentName),
    [agents, agentName],
  );

  const deductOptions = useMemo(() => {
    const set = new Set(periodLabels.filter((p) => payWith && p > payWith));
    if (payWith) set.add(nextPeriodLabel(payWith));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [periodLabels, payWith]);


  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="agentId" value={selected?.agentId ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="agentName">Agent (CRM Sales Rep)</Label>
          <select
            id="agentName"
            name="agentName"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            required
          >
            {agents.length === 0 ? (
              <option value="">No aliases yet — add users first</option>
            ) : (
              agents.map((a) => (
                <option key={`${a.agentId}-${a.agentName}`} value={a.agentName}>
                  {a.agentName}
                  {a.displayName !== a.agentName ? ` · ${a.displayName}` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount ($)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="500.00"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" name="note" placeholder="Requested early Aug pay" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payWithPeriodLabel">Pay with (include on this paycheck)</Label>
          <select
            id="payWithPeriodLabel"
            name="payWithPeriodLabel"
            value={payWith}
            onChange={(e) => {
              const next = e.target.value;
              setPayWith(next);
              if (deductFrom && deductFrom <= next) {
                const later = periodLabels.find((p) => p > next);
                setDeductFrom(later ?? "");
              }
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            required
          >
            {periodLabels.map((p) => (
              <option key={p} value={p}>
                {p} · payday {payLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="deductFromPeriodLabel">Deduct from (recover later)</Label>
          <select
            id="deductFromPeriodLabel"
            name="deductFromPeriodLabel"
            value={deductFrom}
            onChange={(e) => setDeductFrom(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            required
          >
            {deductOptions.length === 0 ? (
              <option value="">Need a later period</option>
            ) : (
              deductOptions.map((p) => (
                <option key={p} value={p}>
                  {p} · payday {payLabel(p)}
                  {!periodLabels.includes(p) ? " (when uploaded)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Example: pay with July (Aug 25 check) and deduct from August (Sept 25 check).
        Net floors at $0 if the later period can’t cover the full advance.
      </p>

      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t save</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || !agents.length || !deductOptions.length}>
        {pending ? "Saving…" : "Give advance"}
      </Button>
    </form>
  );
}
