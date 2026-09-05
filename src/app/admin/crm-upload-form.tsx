"use client";

import { useActionState } from "react";
import { uploadCrmAction, type UploadCrmState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadResultCard } from "@/components/upload-summary-notes";

const initial: UploadCrmState = null;

export function CrmUploadForm() {
  const [state, action, pending] = useActionState(uploadCrmAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="crm-file">CRM export</Label>
          <p className="text-xs text-muted-foreground">
            Rebuilds open calculated periods from this file. Closed months are not
            deleted (new units skipped; clawbacks can still land). Re-upload Cordoba
            after if you need chargebacks on rebuilt months.
          </p>
          <input
            id="crm-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-10 px-4">
          {pending ? "Processing…" : "Upload CRM"}
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
          title="Upload complete"
          batchId={state.summary.uploadBatchId}
          rows={[
            { label: "Open periods rebuilt", items: state.summary.periodsReplacedOpen },
            { label: "New periods", items: state.summary.periodsCreated },
            { label: "Clawbacks applied", items: state.summary.periodsUpdatedClawbacks },
            { label: "Skipped (closed)", items: state.summary.periodsSkippedClosed },
            {
              label: "Skipped (already exists)",
              items: state.summary.periodsSkippedExistingOpen,
            },
          ]}
          notes={state.summary.errors}
        />
      )}
    </div>
  );
}
