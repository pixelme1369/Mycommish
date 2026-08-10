"use client";

import { useActionState } from "react";
import { uploadCrmAction, type UploadCrmState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: UploadCrmState = null;

export function CrmUploadForm() {
  const [state, action, pending] = useActionState(uploadCrmAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="crm-file">CRM export (.csv)</Label>
          <p className="text-sm text-muted-foreground">
            Full-history export. Creates/updates <span className="font-medium">calculated</span>{" "}
            periods. Closed months (past payday) skip new units; clawbacks still apply. Large
            files can take 30–90 seconds — leave this tab open until it finishes.
          </p>
          <input
            id="crm-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-10 px-4">
          {pending ? "Processing… (can take up to ~90s)" : "Upload CRM"}
        </Button>
      </form>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.ok === true && <UploadSummary summary={state.summary} />}
    </div>
  );
}

function UploadSummary({
  summary,
}: {
  summary: Extract<UploadCrmState, { ok: true }>["summary"];
}) {
  const rows: Array<{ label: string; items: string[] }> = [
    { label: "Periods created", items: summary.periodsCreated },
    { label: "Clawbacks applied to existing", items: summary.periodsUpdatedClawbacks },
    { label: "Skipped (closed — new units)", items: summary.periodsSkippedClosed },
    { label: "Skipped (already exists — new units)", items: summary.periodsSkippedExistingOpen },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm">
      <p className="font-medium text-foreground">Upload complete</p>
      <p className="mt-1 text-muted-foreground">Batch {summary.uploadBatchId}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="text-muted-foreground">{row.label}:</span>{" "}
            {row.items.length ? (
              <span className="font-medium text-foreground">{row.items.join(", ")}</span>
            ) : (
              <span className="text-muted-foreground/70">none</span>
            )}
          </li>
        ))}
      </ul>
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
