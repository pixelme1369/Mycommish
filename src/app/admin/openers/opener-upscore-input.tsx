"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setOpenerUpscoreAction } from "@/app/admin/openers/actions";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

export function OpenerUpscoreInput({
  agentId,
  monthLabel,
  amount,
  locked = false,
}: {
  agentId: string;
  monthLabel: string;
  amount: number;
  locked?: boolean;
}) {
  const [state, action, pending] = useActionState(
    setOpenerUpscoreAction,
    null as OpenerLogActionResult | null,
  );
  const defaultValue = amount ? String(amount) : "0";

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="monthLabel" value={monthLabel} />
      <div className="flex items-center gap-1.5">
        <Input
          name="amount"
          inputMode="decimal"
          defaultValue={defaultValue}
          disabled={pending || locked}
          aria-label="Bonus / Upscore"
          className="h-8 w-[6.5rem] bg-[#fff2cc] text-right tabular-nums"
        />
        {!locked ? (
          <Button type="submit" size="sm" className="h-8" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {state?.ok === false ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      {state?.ok === true ? (
        <p className="text-xs text-emerald-700">{state.message || "Saved."}</p>
      ) : null}
    </form>
  );
}
