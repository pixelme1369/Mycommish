"use client";

import { useActionState } from "react";
import { uploadCordobaAction, type UploadCordobaState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadResultCard } from "@/components/upload-summary-notes";

const initial: UploadCordobaState = null;

export function CordobaUploadForm() {
  const [state, action, pending] = useActionState(uploadCordobaAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cordoba-file">Cordoba payout</Label>
          <p className="text-xs text-muted-foreground">
            Paid evidence + chargebacks · upload after CRM · Cordoba ID = CRM External ID
          </p>
          <input
            id="cordoba-file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="mt-1 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
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

      {state?.ok === true && (
        <UploadResultCard
          title="Cordoba upload complete"
          batchId={state.summary.uploadBatchId}
          rows={[
            { label: "New paid IDs", value: String(state.summary.paidNew) },
            {
              label: "Chargeback badges",
              value: String(state.summary.chargebackSeenNew),
            },
            {
              label: "Clawbacks applied",
              value: `${state.summary.clawbacksApplied} ($${state.summary.clawbackTotal.toFixed(2)})`,
            },
            {
              label: "Snapshots",
              value: `${state.summary.snapshotsListed}/${state.summary.snapshotsUpdated}`,
            },
          ]}
          notes={state.summary.errors}
        >
          <SkipChips
            items={[
              { label: "Not commissioned", count: state.summary.skippedNotCommissioned.length },
              {
                label: "Not confirmed paid",
                count: state.summary.skippedNotConfirmedPaid.length,
              },
              { label: "Already clawed", count: state.summary.skippedAlreadyClawed.length },
              {
                label: "No dropped date",
                count: state.summary.skippedNoDroppedDate.length,
              },
              {
                label: "Unmatched chargeback",
                count: state.summary.chargebackUnmatched.length,
              },
              {
                label: "Paid ID not in CRM",
                count: state.summary.paidUnmatched.length,
              },
            ]}
          />
        </UploadResultCard>
      )}
    </div>
  );
}

function SkipChips({ items }: { items: Array<{ label: string; count: number }> }) {
  const shown = items.filter((i) => i.count > 0);
  if (!shown.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {shown.map((i) => (
        <span
          key={i.label}
          className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          {i.label} · {i.count}
        </span>
      ))}
    </div>
  );
}
