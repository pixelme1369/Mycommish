"use client";

import { useActionState } from "react";
import {
  formatOpenerPayStatus,
  OPENER_PAY_APPROVED,
  OPENER_PAY_EXCLUDED,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import {
  setOpenerPayStatusAction,
} from "@/app/admin/openers/actions";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

export function OpenerPayStatusSelect({
  logId,
  payStatus,
  overridden,
}: {
  logId: string;
  payStatus: OpenerPayStatusName;
  overridden: boolean;
}) {
  const [state, action, pending] = useActionState(
    setOpenerPayStatusAction,
    null as OpenerLogActionResult | null,
  );

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={logId} />
      <select
        name="payStatus"
        defaultValue={payStatus}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value={OPENER_PAY_APPROVED}>
          {formatOpenerPayStatus(OPENER_PAY_APPROVED)}
        </option>
        <option value={OPENER_PAY_EXCLUDED}>
          {formatOpenerPayStatus(OPENER_PAY_EXCLUDED)}
        </option>
        {overridden ? <option value="auto">Reset to auto</option> : null}
      </select>
      {overridden ? (
        <p className="text-[11px] text-muted-foreground">Manual</p>
      ) : null}
      {state?.ok === false ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
