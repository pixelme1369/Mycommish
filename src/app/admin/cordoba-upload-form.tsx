"use client";

import { useActionState } from "react";
import { uploadCordobaAction, type UploadCordobaState } from "./actions";

const initial: UploadCordobaState = null;

export function CordobaUploadForm() {
  const [state, action, pending] = useActionState(uploadCordobaAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="cordoba-file" className="block text-sm font-medium text-zinc-800">
            Cordoba payout (.xlsx)
          </label>
          <p className="mt-1 text-sm text-zinc-500">
            First Pays + EPF confirm paid evidence. Chargebacks claw commission using{" "}
            <span className="font-medium">our</span> dropped date and enrolled debt — never the
            file&apos;s Dropped Date or Marketing Payout Debt. Closed months still accept clawbacks.
          </p>
          <input
            id="cordoba-file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="mt-3 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Processing…" : "Upload Cordoba"}
        </button>
      </form>

      {state?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
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
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm">
      <p className="font-medium text-zinc-900">Cordoba upload complete</p>
      <p className="mt-1 text-zinc-500">Batch {summary.uploadBatchId}</p>
      <ul className="mt-3 space-y-1 text-zinc-700">
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
      <SkipList label="Skipped — no dropped date on our records" items={summary.skippedNoDroppedDate} />
      <SkipList label="Chargeback unmatched (no CRM row)" items={summary.chargebackUnmatched} />
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

function SkipList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="font-medium text-zinc-800">
        {label} ({items.length})
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-600">
        {items.slice(0, 15).map((i) => (
          <li key={i}>{i}</li>
        ))}
        {items.length > 15 ? <li>…and {items.length - 15} more</li> : null}
      </ul>
    </div>
  );
}
