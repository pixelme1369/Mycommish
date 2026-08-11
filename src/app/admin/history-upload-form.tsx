"use client";

import { useActionState } from "react";
import { uploadHistoryAction, type UploadHistoryState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { UploadResultCard } from "@/components/upload-summary-notes";

const initial: UploadHistoryState = null;
const defaultYear = new Date().getFullYear() - 1;

export function HistoryUploadForm() {
  const [state, action, pending] = useActionState(uploadHistoryAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="history-file">History ledger</Label>
          <p className="text-xs text-muted-foreground">
            Optional backfill · agents never see these as owed
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="history-year" className="text-xs">
                Year
              </Label>
              <Input
                id="history-year"
                name="year"
                type="number"
                required
                min={2000}
                max={2100}
                defaultValue={defaultYear}
                className="h-10 w-24 bg-background/80"
              />
            </div>
            <input
              id="history-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full max-w-sm text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
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
        <UploadResultCard
          title="History upload complete"
          batchId={state.summary.uploadBatchId}
          rows={[
            { label: "Periods created", items: state.summary.periodsCreated },
            { label: "Skipped (already imported)", items: state.summary.periodsSkipped },
          ]}
          notes={state.summary.errors.map(String)}
        />
      )}
    </div>
  );
}

