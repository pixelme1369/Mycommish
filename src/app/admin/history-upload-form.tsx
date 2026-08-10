"use client";

import { useActionState } from "react";
import { uploadHistoryAction, type UploadHistoryState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: UploadHistoryState = null;
const defaultYear = new Date().getFullYear() - 1;

export function HistoryUploadForm() {
  const [state, action, pending] = useActionState(uploadHistoryAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="history-file">Commission history ledger (.csv / .xlsx)</Label>
          <p className="text-sm text-muted-foreground">
            Prior account-manager ledger — anti-double-pay reference only. Agents never see these
            as owed. Optional <span className="font-medium">Rate</span> is saved for later CRM
            clawbacks (debt × rate). Month column has no year — set it below.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="history-year" className="text-xs">
                Calendar year
              </Label>
              <Input
                id="history-year"
                name="year"
                type="number"
                required
                min={2000}
                max={2100}
                defaultValue={defaultYear}
                className="h-10 w-28 bg-background/80"
              />
            </div>
            <input
              id="history-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full max-w-md text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
        </div>
        <Button type="submit" disabled={pending} className="h-10 px-4">
          {pending ? "Processing…" : "Upload history"}
        </Button>
      </form>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.ok === true && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm">
          <p className="font-medium text-foreground">History upload complete</p>
          <p className="mt-1 text-muted-foreground">Batch {state.summary.uploadBatchId}</p>
          <ul className="mt-3 space-y-1 text-foreground/90">
            <li>
              Periods created:{" "}
              <span className="font-medium">
                {state.summary.periodsCreated.length
                  ? state.summary.periodsCreated.join(", ")
                  : "none"}
              </span>
            </li>
            <li>
              Skipped (already imported):{" "}
              <span className="font-medium">
                {state.summary.periodsSkipped.length
                  ? state.summary.periodsSkipped.join(", ")
                  : "none"}
              </span>
            </li>
          </ul>
          {state.summary.errors.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="font-medium text-amber-800">Notes / warnings</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-900">
                {[...new Set(state.summary.errors)].slice(0, 20).map((e) => (
                  <li key={String(e)}>{String(e)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
