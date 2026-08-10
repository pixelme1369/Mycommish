import Link from "next/link";
import { CrmUploadForm } from "./crm-upload-form";
import { CordobaUploadForm } from "./cordoba-upload-form";
import { HistoryUploadForm } from "./history-upload-form";
import { DeletePeriodButton } from "./delete-period-button";
import { DeleteHistoryPeriodButton } from "./delete-history-period-button";
import {
  DeleteAllPeriodsButton,
  DeleteUploadByFilenameButton,
} from "./delete-bulk-periods-button";
import { ClosePeriodButton } from "./close-period-button";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

type PeriodRow = Awaited<ReturnType<typeof listCalculatedPeriods>>[number];

function groupByFilename(periods: PeriodRow[]) {
  const map = new Map<string, PeriodRow[]>();
  for (const p of periods) {
    const key = p.filename?.trim() || "(no filename)";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()];
}

export default async function AdminHome() {
  const session = await requireAdmin();
  const [periods, historyPeriods, uploads] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
  ]);

  const calculatedGroups = groupByFilename(periods);
  const historyGroups = groupByFilename(historyPeriods);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              mycommish
            </Link>{" "}
            · admin · {session.user.displayName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/agents" className="text-sm text-zinc-500 hover:underline">
            Manage agents
          </Link>
          <Link href="/portal" className="text-sm text-zinc-500 hover:underline">
            Portal
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">Upload order</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <span className="font-medium">History</span> (if you have a prior ledger) — blocks
            double-pay and stores Rate for later clawbacks
          </li>
          <li>
            <span className="font-medium">CRM</span> — calculated commissions + our dropped dates
          </li>
          <li>
            <span className="font-medium">Cordoba</span> last — needs CRM clears/drops to place
            chargebacks
          </li>
        </ol>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">1. Commission history</h2>
        <div className="mt-4">
          <HistoryUploadForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">2. CRM upload</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Months that already exist skip new units — delete them below first if you need a clean
          re-import.
        </p>
        <div className="mt-4">
          <CrmUploadForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">3. Cordoba payout</h2>
        <div className="mt-4">
          <CordobaUploadForm />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Calculated periods</h2>
          {periods.length > 0 ? (
            <DeleteAllPeriodsButton kind="calculated" count={periods.length} />
          ) : null}
        </div>
        {periods.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">None yet — upload a CRM export.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {calculatedGroups.map(([filename, group]) => (
              <div
                key={`crm-${filename}`}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm">
                  <span className="font-medium text-zinc-800">{filename}</span>
                  <div className="flex items-center gap-3 text-zinc-500">
                    <span>
                      {group.length} period{group.length === 1 ? "" : "s"}
                    </span>
                    {filename !== "(no filename)" ? (
                      <DeleteUploadByFilenameButton
                        filename={filename}
                        kind="calculated"
                        periodCount={group.length}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-zinc-200">
                  {group.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div>
                        <Link
                          href={`/admin/periods/${p.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {p.periodLabel}
                        </Link>
                        <span className="ml-2 text-zinc-500">{p.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-500">
                        <Link href={`/admin/periods/${p.id}`} className="hover:underline">
                          {p._count.agentPeriods} agent
                          {p._count.agentPeriods === 1 ? "" : "s"}
                        </Link>
                        {p.status === "open" ? (
                          <ClosePeriodButton periodId={p.id} periodLabel={p.periodLabel} />
                        ) : null}
                        <DeletePeriodButton periodId={p.id} periodLabel={p.periodLabel} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">History periods (audit only)</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Not shown to agents as owed. Used to block double-pay and supply Rate for clawbacks.
            </p>
          </div>
          {historyPeriods.length > 0 ? (
            <DeleteAllPeriodsButton kind="history" count={historyPeriods.length} />
          ) : null}
        </div>
        {historyPeriods.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">None yet — upload a history ledger.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {historyGroups.map(([filename, group]) => (
              <div
                key={`hist-${filename}`}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm">
                  <span className="font-medium text-zinc-800">{filename}</span>
                  <div className="flex items-center gap-3 text-zinc-500">
                    <span>
                      {group.length} period{group.length === 1 ? "" : "s"}
                    </span>
                    {filename !== "(no filename)" ? (
                      <DeleteUploadByFilenameButton
                        filename={filename}
                        kind="history"
                        periodCount={group.length}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-zinc-200">
                  {group.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div>
                        <Link
                          href={`/admin/history/${p.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {p.periodLabel}
                        </Link>
                        <span className="ml-2 text-zinc-500">history</span>
                      </div>
                      <div className="flex items-center gap-4 text-zinc-500">
                        <Link href={`/admin/history/${p.id}`} className="hover:underline">
                          {p._count.agentPeriods} agent
                          {p._count.agentPeriods === 1 ? "" : "s"}
                        </Link>
                        <DeleteHistoryPeriodButton
                          periodId={p.id}
                          periodLabel={p.periodLabel}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium">Recent uploads</h2>
        {uploads.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No upload batches yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <Link
                    href={`/admin/uploads/${u.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {u.type}
                  </Link>
                  <span className="ml-2 text-zinc-700">{u.filename}</span>
                </div>
                <Link
                  href={`/admin/uploads/${u.id}`}
                  className="text-zinc-500 hover:underline"
                >
                  {u.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
