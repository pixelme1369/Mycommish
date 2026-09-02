"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { setOpenerUpscoreAction } from "@/app/admin/openers/actions";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

export function OpenerUpscoreInput({
  agentId,
  monthLabel,
  amount,
}: {
  agentId: string;
  monthLabel: string;
  amount: number;
}) {
  const [state, action, pending] = useActionState(
    setOpenerUpscoreAction,
    null as OpenerLogActionResult | null,
  );
  const defaultValue = amount ? String(amount) : "0";

  return (
    <form
      action={action}
      onBlur={(e) => {
        const form = e.currentTarget;
        const next = String(new FormData(form).get("amount") || "");
        if (next !== defaultValue) form.requestSubmit();
      }}
      className="flex flex-col items-end"
    >
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="monthLabel" value={monthLabel} />
      <Input
        name="amount"
        inputMode="decimal"
        defaultValue={defaultValue}
        disabled={pending}
        aria-label="Bonus / Upscore"
        className="h-8 w-[6.5rem] bg-[#fff2cc] text-right tabular-nums"
      />
      {state?.ok === false ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
