"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  setClawbackPaidRateAction,
  type ClawbackPaidRateFormState,
} from "./clawback-paid-rate-actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}>
      {pending ? "…" : "Save"}
    </Button>
  );
}

export function ClawbackPaidRateEditor({
  clientEventId,
  crmId,
  cordobaOnly,
  paidRate,
  periodId,
  agentPeriodId,
}: {
  clientEventId: string;
  crmId: string;
  cordobaOnly: boolean;
  paidRate: number | null;
  periodId: string;
  agentPeriodId: string;
}) {
  const [state, action] = useActionState<ClawbackPaidRateFormState, FormData>(
    setClawbackPaidRateAction,
    null,
  );

  const displayRate = state?.ok && state.paidRate != null ? state.paidRate : paidRate;
  const defaultPct =
    displayRate != null && displayRate > 0
      ? (Math.round(displayRate * 10000) / 100).toString()
      : "";

  return (
    <div className="min-w-[7.5rem]">
      <form action={action} className="flex items-center gap-1" key={defaultPct || "empty"}>
        <input type="hidden" name="clientEventId" value={clientEventId} />
        <input type="hidden" name="crmId" value={crmId} />
        <input type="hidden" name="cordobaOnly" value={cordobaOnly ? "true" : "false"} />
        <input type="hidden" name="periodId" value={periodId} />
        <input type="hidden" name="agentPeriodId" value={agentPeriodId} />
        <Input
          name="ratePercent"
          defaultValue={defaultPct}
          placeholder="1.75"
          inputMode="decimal"
          className="h-7 w-[4.25rem] px-1.5 text-xs tabular-nums"
          aria-label="Paid rate percent"
          title="Paid commission rate % (e.g. 1.75)"
        />
        <span className="text-[11px] text-muted-foreground">%</span>
        <SubmitBtn />
      </form>
      {state && !state.ok ? (
        <p className="mt-1 max-w-[11rem] text-[10px] leading-snug text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="mt-1 max-w-[11rem] text-[10px] leading-snug text-muted-foreground">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
