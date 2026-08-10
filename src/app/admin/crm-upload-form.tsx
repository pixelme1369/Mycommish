"use client";

import { useActionState } from "react";
import { uploadCrmAction, type UploadCrmState } from "./actions";

const initial: UploadCrmState = null;

export function CrmUploadForm() {
  const [state, action, pending] = useActionState(uploadCrmAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="crm-file" className="block text-sm font-medium text-zinc-800">
            CRM export (.csv)
          </label>
          <p className="mt-1 text-sm text-zinc-500">
            Full-history export. Creates/updates <span className="font-medium">calculated</span>{" "}
            periods. Closed months (past payday) skip new units; clawbacks still apply. Large files
            can take 30–90 seconds — leave this tab open until it finishes.
          </p>
          <input
            id="crm-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-3 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Processing… (can take up to ~90s)" : "Upload CRM"}
        </button>
      </form>

      {state?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
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
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm">
      <p className="font-medium text-zinc-900">Upload complete</p>
      <p className="mt-1 text-zinc-500">Batch {summary.uploadBatchId}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="text-zinc-600">{row.label}:</span>{" "}
            {row.items.length ? (
              <span className="font-medium text-zinc-900">{row.items.join(", ")}</span>
            ) : (
              <span className="text-zinc-400">none</span>
            )}
          </li>
        ))}
      </ul>
      {summary.errors.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
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
