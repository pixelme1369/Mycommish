"use client";

import { useActionState, useMemo, useState } from "react";
import { createManagerBonusAction, type BonusFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { periodLabelForNextPayDate } from "@/lib/manager-bonus-dates";
import { paymentDateForPeriod } from "@/lib/commission/calculator";
import { cn } from "@/lib/utils";

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
  agents: Array<{ id: string; displayName: string; role?: string }>;
}) {
  const [state, action, pending] = useActionState(createManagerBonusAction, initial);
  const [paidOn, setPaidOn] = useState(todayLocalYmd);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAgentId, setRecipientAgentId] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const periodLabel = periodLabelForNextPayDate();

  const matches = useMemo(() => {
    const q = recipientName.trim().toLowerCase();
    if (!q) return agents.slice(0, 10);
    return agents.filter((a) => a.displayName.toLowerCase().includes(q)).slice(0, 10);
  }, [agents, recipientName]);

  const exactMatch = useMemo(() => {
    const q = recipientName.trim().toLowerCase();
    if (!q) return null;
    return agents.find((a) => a.displayName.toLowerCase() === q) ?? null;
  }, [agents, recipientName]);

  function pick(agent: { id: string; displayName: string; role?: string }) {
    setRecipientName(agent.displayName);
    setRecipientAgentId(agent.id);
    setOpen(false);
  }

  function onNameChange(value: string) {
    setRecipientName(value);
    setOpen(true);
    setHighlight(0);
    const hit = agents.find((a) => a.displayName.toLowerCase() === value.trim().toLowerCase());
    setRecipientAgentId(hit?.id ?? "");
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="recipientAgentId" value={recipientAgentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative space-y-1.5">
          <Label htmlFor="recipientName">Agent</Label>
          <Input
            id="recipientName"
            name="recipientName"
            required
            autoComplete="off"
            value={recipientName}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
              if (!recipientAgentId && exactMatch) {
                setRecipientAgentId(exactMatch.id);
              }
            }}
            onKeyDown={(e) => {
              if (!open || matches.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && matches[highlight]) {
                e.preventDefault();
                pick(matches[highlight]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type or pick a name…"
          />
          {open && matches.length > 0 ? (
            <ul
              className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-md"
              role="listbox"
            >
              {matches.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-sm hover:bg-muted",
                      i === highlight && "bg-muted",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(a)}
                  >
                    {a.displayName}
                    {a.role === "manager" ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">manager</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {recipientAgentId
              ? "Linked to a portal user."
              : "Not in the list? Type the name — it still saves."}
          </p>
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

      <Button type="submit" disabled={pending} size="sm">
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
