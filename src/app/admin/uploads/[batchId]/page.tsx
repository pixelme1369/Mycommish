import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { getUploadBatch } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UploadBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  await requireAdmin();
  const { batchId } = await params;
  const batch = await getUploadBatch(batchId);
  if (!batch) notFound();

  const summary = (batch.summaryJson ?? null) as Record<string, unknown> | null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500">
          <Link href="/admin" className="hover:underline">
            ← Admin
          </Link>
        </p>
        <SignOutButton />
      </div>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Upload batch</h1>
      <p className="mt-1 text-sm text-zinc-500">
        <span className="font-medium text-zinc-800">{batch.type}</span>
        {" · "}
        {batch.filename}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {batch.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
        {batch.uploadedBy
          ? ` · ${batch.uploadedBy.displayName} <${batch.uploadedBy.email}>`
          : ""}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Client events" value={String(batch._count.clientEvents)} />
        <Stat label="Ledger rows" value={String(batch._count.ledgerEntries)} />
        <Stat label="Batch id" value={batch.id.slice(0, 12) + "…"} mono />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Summary</h2>
        {!summary ? (
          <p className="mt-3 text-sm text-zinc-500">No summaryJson stored for this batch.</p>
        ) : (
          <div className="mt-3 space-y-4 rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm">
            {renderSummary(batch.type, summary)}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 ${mono ? "font-mono text-sm" : "text-lg font-medium"}`}>{value}</p>
    </div>
  );
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x));
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function renderSummary(type: string, summary: Record<string, unknown>) {
  if (type === "crm") {
    return (
      <>
        <SummaryLine label="Periods created" items={asStringList(summary.periodsCreated)} />
        <SummaryLine
          label="Clawbacks on existing"
          items={asStringList(summary.periodsUpdatedClawbacks)}
        />
        <SummaryLine
          label="Skipped closed (new units)"
          items={asStringList(summary.periodsSkippedClosed)}
        />
        <SummaryLine
          label="Skipped existing open"
          items={asStringList(summary.periodsSkippedExistingOpen)}
        />
        <SummaryLine label="Errors / notes" items={asStringList(summary.errors)} warn />
      </>
    );
  }

  if (type === "cordoba") {
    return (
      <>
        <p>
          New paid IDs: <strong>{asNumber(summary.paidNew) ?? "—"}</strong>
        </p>
        <p>
          Chargeback badges: <strong>{asNumber(summary.chargebackSeenNew) ?? "—"}</strong>
        </p>
        <p>
          Clawbacks applied:{" "}
          <strong>
            {asNumber(summary.clawbacksApplied) ?? "—"} ($
            {(asNumber(summary.clawbackTotal) ?? 0).toFixed(2)})
          </strong>
        </p>
        <p>
          Snapshots listed/updated:{" "}
          <strong>
            {asNumber(summary.snapshotsListed) ?? 0}/{asNumber(summary.snapshotsUpdated) ?? 0}
          </strong>
        </p>
        <SummaryLine
          label="Skipped — not commissioned"
          items={asStringList(summary.skippedNotCommissioned)}
          warn
        />
        <SummaryLine
          label="Skipped — not confirmed paid"
          items={asStringList(summary.skippedNotConfirmedPaid)}
          warn
        />
        <SummaryLine
          label="Skipped — already clawed"
          items={asStringList(summary.skippedAlreadyClawed)}
          warn
        />
        <SummaryLine
          label="Skipped — no dropped date"
          items={asStringList(summary.skippedNoDroppedDate)}
          warn
        />
        <SummaryLine
          label="Unmatched chargebacks"
          items={asStringList(summary.chargebackUnmatched)}
          warn
        />
        <SummaryLine
          label="Paid IDs not in CRM (External ID)"
          items={asStringList(summary.paidUnmatched)}
          warn
        />
        <SummaryLine label="Errors / notes" items={asStringList(summary.errors)} warn />
      </>
    );
  }

  if (type === "history") {
    return (
      <>
        <SummaryLine label="Periods created" items={asStringList(summary.periodsCreated)} />
        <SummaryLine label="Periods skipped" items={asStringList(summary.periodsSkipped)} warn />
        <SummaryLine label="Errors / notes" items={asStringList(summary.errors)} warn />
      </>
    );
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-zinc-700">
      {JSON.stringify(summary, null, 2)}
    </pre>
  );
}

function SummaryLine({
  label,
  items,
  warn,
}: {
  label: string;
  items: string[];
  warn?: boolean;
}) {
  if (!items.length && warn) return null;
  return (
    <div className={warn ? "border-t border-zinc-100 pt-3" : undefined}>
      <p className={warn ? "font-medium text-amber-800" : "text-zinc-600"}>
        {label}
        {items.length ? ` (${items.length})` : ""}:
      </p>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-800">
          {items.slice(0, 40).map((i) => (
            <li key={i}>{i}</li>
          ))}
          {items.length > 40 ? <li>…and {items.length - 40} more</li> : null}
        </ul>
      ) : (
        <p className="mt-1 text-zinc-400">none</p>
      )}
    </div>
  );
}
