"use client";

import { useActionState } from "react";
import { uploadHistoryAction, type UploadHistoryState } from "./actions";

const initial: UploadHistoryState = null;
const defaultYear = new Date().getFullYear() - 1;

export function HistoryUploadForm() {
  const [state, action, pending] = useActionState(uploadHistoryAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="history-file" className="block text-sm font-medium text-zinc-800">
            Commission history ledger (.csv / .xlsx)
          </label>
          <p className="mt-1 text-sm text-zinc-500">
            Prior account-manager ledger — anti-double-pay reference only. Agents never see these
            as owed. Optional <span className="font-medium">Rate</span> is saved for later CRM
            clawbacks (debt × rate). Month column has no year — set it below.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="history-year" className="block text-xs font-medium text-zinc-600">
                Calendar year
              </label>
              <input
                id="history-year"
                name="year"
                type="number"
                required
                min={2000}
                max={2100}
                defaultValue={defaultYear}
                className="mt-1 h-10 w-28 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              />
            </div>
            <input
              id="history-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full max-w-md text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Processing…" : "Upload history"}
        </button>
      </form>

      {state?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      {state?.ok === true && (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm">
          <p className="font-medium text-zinc-900">History upload complete</p>
          <p className="mt-1 text-zinc-500">Batch {state.summary.uploadBatchId}</p>
          <ul className="mt-3 space-y-1 text-zinc-700">
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
            <div className="mt-3 border-t border-zinc-100 pt-3">
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
