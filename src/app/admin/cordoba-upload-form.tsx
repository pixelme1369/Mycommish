"use client";

import { useActionState } from "react";
import { uploadCordobaAction, type UploadCordobaState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: UploadCordobaState = null;

export function CordobaUploadForm() {
  const [state, action, pending] = useActionState(uploadCordobaAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cordoba-file">Cordoba payout (.xlsx)</Label>
          <p className="text-sm text-muted-foreground">
            First Pays + EPF confirm paid evidence. Chargebacks claw commission using{" "}
            <span className="font-medium">our</span> dropped date and enrolled debt — never the
            file&apos;s Dropped Date or Marketing Payout Debt. Closed months still accept
            clawbacks.
          </p>
          <input
            id="cordoba-file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="mt-1 block w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-10 px-4">
          {pending ? "Processing…" : "Upload Cordoba"}
        </Button>
      </form>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.ok === true && <CordobaSummary summary={state.summary} />}
    </div>
  );
}

function CordobaSummary({
  summary,
}: {
  summary: Extract<UploadCordobaState, { ok: true }>["summary"];
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm">
      <p className="font-medium text-foreground">Cordoba upload complete</p>
      <p className="mt-1 text-muted-foreground">Batch {summary.uploadBatchId}</p>
      <ul className="mt-3 space-y-1 text-foreground/90">
        <li>
          New paid IDs: <span className="font-medium">{summary.paidNew}</span>
        </li>
        <li>
          Chargeback badges marked:{" "}
          <span className="font-medium">{summary.chargebackSeenNew}</span>
        </li>
        <li>
          Clawbacks applied:{" "}
          <span className="font-medium">
            {summary.clawbacksApplied} (${summary.clawbackTotal.toFixed(2)})
          </span>
        </li>
        <li>
          Snapshots listed/updated:{" "}
          <span className="font-medium">
            {summary.snapshotsListed}/{summary.snapshotsUpdated}
          </span>
        </li>
      </ul>
      <SkipList label="Skipped — not commissioned" items={summary.skippedNotCommissioned} />
      <SkipList label="Skipped — not confirmed paid" items={summary.skippedNotConfirmedPaid} />
      <SkipList label="Skipped — already clawed" items={summary.skippedAlreadyClawed} />
      <SkipList
        label="Skipped — no dropped date on our records"
        items={summary.skippedNoDroppedDate}
      />
      <SkipList label="Chargeback unmatched (no CRM row)" items={summary.chargebackUnmatched} />
      {summary.errors.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="font-medium text-amber-800">Notes / warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-900">
            {[...new Set(summary.errors)].slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SkipList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="font-medium text-foreground">
        {label} ({items.length})
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.slice(0, 15).map((i) => (
          <li key={i}>{i}</li>
        ))}
        {items.length > 15 ? <li>…and {items.length - 15} more</li> : null}
      </ul>
    </div>
  );
}
