"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import type { ManualBonusView } from "@/lib/manual-bonuses";
import {
  approveManualBonusAction,
  createManualBonusAction,
  deleteManualBonusAction,
  updateManualBonusAction,
  type ManualBonusFormState,
} from "./manual-bonus-actions";

export function ManualBonusSection({
  periodId,
  agentPeriodId,
  bonuses,
  canManage,
  canApprove,
}: {
  periodId: string;
  agentPeriodId: string;
  bonuses: ManualBonusView[];
  /** Managers — add / edit / delete pending. */
  canManage: boolean;
  /** Super admins — approve pending. */
  canApprove: boolean;
}) {
  const pending = bonuses.filter((b) => b.status === "pending");
  const approved = bonuses.filter((b) => b.status === "approved");
  const show = canManage || canApprove || bonuses.length > 0;
  if (!show) return null;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-base tracking-tight">Manual bonus</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manager-entered bonus with a note (managers and super admins). Counts in net
            commission only after super-admin approval. Pending amounts are visible to the
            agent but not included in net yet.
          </p>
        </div>
      </div>

      {canManage ? (
        <CreateManualBonusForm periodId={periodId} agentPeriodId={agentPeriodId} />
      ) : null}

      {pending.length === 0 && approved.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No manual bonuses for this period.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((b) => (
            <ManualBonusRow
              key={b.id}
              bonus={b}
              periodId={periodId}
              agentPeriodId={agentPeriodId}
              canManage={canManage}
              canApprove={canApprove}
            />
          ))}
          {approved.map((b) => (
            <ManualBonusRow
              key={b.id}
              bonus={b}
              periodId={periodId}
              agentPeriodId={agentPeriodId}
              canManage={false}
              canApprove={false}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateManualBonusForm({
  periodId,
  agentPeriodId,
}: {
  periodId: string;
  agentPeriodId: string;
}) {
  const [state, action, pending] = useActionState(
    createManualBonusAction,
    null as ManualBonusFormState,
  );

  return (
    <form
      action={action}
      className="mt-4 grid gap-3 rounded-xl bg-muted/30 p-4 ring-1 ring-border/60 sm:grid-cols-[8rem_1fr_auto]"
    >
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="agentPeriodId" value={agentPeriodId} />
      <div className="space-y-1.5">
        <Label htmlFor="mb-amount">Amount</Label>
        <Input
          id="mb-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          placeholder="0.00"
          className="tabular-nums"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mb-note">Note</Label>
        <Input id="mb-note" name="note" required placeholder="Reason for this bonus" />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-money sm:col-span-3">{state.message}</p>
      ) : null}
    </form>
  );
}

function ManualBonusRow({
  bonus,
  periodId,
  agentPeriodId,
  canManage,
  canApprove,
}: {
  bonus: ManualBonusView;
  periodId: string;
  agentPeriodId: string;
  canManage: boolean;
  canApprove: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    updateManualBonusAction,
    null as ManualBonusFormState,
  );

  if (editing && canManage && bonus.status === "pending") {
    return (
      <li className="rounded-xl bg-background p-4 ring-1 ring-border/70">
        <form action={action} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
          <input type="hidden" name="bonusId" value={bonus.id} />
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="agentPeriodId" value={agentPeriodId} />
          <div className="space-y-1.5">
            <Label htmlFor={`edit-amt-${bonus.id}`}>Amount</Label>
            <Input
              id={`edit-amt-${bonus.id}`}
              name="amount"
              type="text"
              inputMode="decimal"
              required
              defaultValue={String(bonus.amount)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-note-${bonus.id}`}>Note</Label>
            <Input
              id={`edit-note-${bonus.id}`}
              name="note"
              required
              defaultValue={bonus.note}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
          {state && !state.ok ? (
            <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl bg-background p-4 ring-1 ring-border/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-money">
              {money(bonus.amount)}
            </span>
            {bonus.status === "pending" ? (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Pending approval
              </Badge>
            ) : (
              <Badge className="bg-primary/15 text-[10px] uppercase tracking-wide text-money">
                Approved
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground">{bonus.note}</p>
          <p className="text-[11px] text-muted-foreground">
            Logged by {bonus.createdByName}
            {bonus.status === "approved" && bonus.approvedByName
              ? ` · approved by ${bonus.approvedByName}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && bonus.status === "pending" ? (
            <form action={approveManualBonusAction}>
              <input type="hidden" name="bonusId" value={bonus.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="agentPeriodId" value={agentPeriodId} />
              <Button type="submit" size="sm">
                Approve
              </Button>
            </form>
          ) : null}
          {canManage && bonus.status === "pending" ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <form action={deleteManualBonusAction}>
                <input type="hidden" name="bonusId" value={bonus.id} />
                <input type="hidden" name="periodId" value={periodId} />
                <input type="hidden" name="agentPeriodId" value={agentPeriodId} />
                <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                  Delete
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
