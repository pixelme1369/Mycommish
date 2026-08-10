import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import {
  cancelRatePercent,
  getClientsForAgentPeriod,
  getCordobaFlags,
  getScopedAgentPeriod,
  mergeClawbacksWithCordoba,
  money,
  ratePercent,
  type MergedClawbackRow,
} from "@/lib/portal/queries";
import type { ClientEvent } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string; agentPeriodId: string }>;
}) {
  const session = await requireSession();
  const { periodId, agentPeriodId } = await params;
  const aliases = new Set(session.user.aliasNames || []);

  // Admins can open any calculated agent period; agents only their aliases in latest-2.
  let row = null;
  if (session.user.isAdmin) {
    const { prisma } = await import("@/lib/db");
    const { PeriodSource } = await import("@/generated/prisma/client");
    row = await prisma.agentPeriod.findFirst({
      where: {
        id: agentPeriodId,
        periodId,
        period: { source: PeriodSource.calculated },
      },
      include: { period: true },
    });
  } else {
    for (const name of aliases) {
      row = await getScopedAgentPeriod(periodId, agentPeriodId, name);
      if (row) break;
    }
  }
  if (!row) notFound();

  const { cleared, clawbacks, pending, cancelled, all } = await getClientsForAgentPeriod(
    row.id,
  );
  const { paidIds, chargebackSeenIds } = await getCordobaFlags(all.map((e) => e.crmId));
  const mergedClawbacks = await mergeClawbacksWithCordoba(
    row.agentName,
    row.period.periodLabel,
    clawbacks,
  );
  const showAdminCordobaClawback = session.user.isAdmin;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500">
          {session.user.isAdmin ? (
            <Link href={`/admin/periods/${periodId}`} className="hover:underline">
              ← {row.period.periodLabel} agents
            </Link>
          ) : (
            <Link href="/portal" className="hover:underline">
              ← My commissions
            </Link>
          )}
        </p>
        <SignOutButton />
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {row.agentName} · {row.period.periodLabel}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Status: {row.period.status} · source: calculated
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Units" value={String(row.unitsCleared)} />
        <Stat
          label="Tier / rate"
          value={
            row.cancellationPenaltyApplied
              ? `${row.rawTier}→${row.adjustedTier} · ${ratePercent(row.tierRate)}`
              : `${row.adjustedTier || "—"} · ${ratePercent(row.tierRate)}`
          }
        />
        <Stat label="Gross" value={money(row.grossCommission)} />
        <Stat label="Net" value={money(row.netCommission)} accent />
        <Stat
          label="Clawback"
          value={Number(row.clawbackAmount) > 0 ? `-${money(row.clawbackAmount)}` : "—"}
        />
        <Stat label="Cancel rate" value={cancelRatePercent(row.cancellationRate)} />
        <Stat label="Pending units" value={String(row.pendingUnits)} />
        <Stat label="Cleared debt" value={money(row.totalClearedDebt)} />
      </div>

      {row.notes ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {row.notes}
        </p>
      ) : null}

      <ClearedSection
        clients={cleared}
        paidIds={paidIds}
        chargebackSeenIds={chargebackSeenIds}
        showCordobaClawback={showAdminCordobaClawback}
      />
      <ClawbackSection rows={mergedClawbacks} />
      <ClientSection title="Pending" clients={pending} empty="No pending clients." />
      <ClientSection
        title="Cancelled (not clawed)"
        clients={cancelled}
        empty="No same-month / safe cancels."
      />
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg ${accent ? "font-semibold" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function YesNo({ yes, tone }: { yes: boolean; tone: "green" | "red" | "amber" }) {
  if (!yes) {
    return <span className="text-zinc-500">No</span>;
  }
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "red"
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-800";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>Yes</span>
  );
}

function ClearedSection({
  clients,
  paidIds,
  chargebackSeenIds,
  showCordobaClawback,
}: {
  clients: ClientEvent[];
  paidIds: Set<string>;
  chargebackSeenIds: Set<string>;
  showCordobaClawback: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">
        Cleared clients{" "}
        <span className="text-sm font-normal text-zinc-500">({clients.length})</span>
      </h2>
      {clients.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No cleared clients.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Cordoba Payout</th>
                {showCordobaClawback ? (
                  <th className="px-3 py-2 font-medium">Cordoba Clawback</th>
                ) : null}
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{money(c.commissionOnClient)}</td>
                  <td className="px-3 py-2">
                    <YesNo yes={paidIds.has(c.crmId)} tone={paidIds.has(c.crmId) ? "green" : "amber"} />
                  </td>
                  {showCordobaClawback ? (
                    <td className="px-3 py-2">
                      <YesNo
                        yes={chargebackSeenIds.has(c.crmId)}
                        tone={chargebackSeenIds.has(c.crmId) ? "red" : "amber"}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClawbackSection({ rows }: { rows: MergedClawbackRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">
        Clawbacks{" "}
        <span className="text-sm font-normal text-zinc-500">({rows.length})</span>
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Cordoba Charge back is Yes when Cordoba&apos;s Chargebacks tab also lists the client. A
        $0.00 row with Yes means flagged but not deducted yet (usually no Dropped Date on file).
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No clawbacks.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Clawback</th>
                <th className="px-3 py-2 font-medium">Cordoba Charge back</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((c) => (
                <tr key={c.id} className={c.cordobaOnly ? "bg-zinc-50/80" : undefined}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2">
                    <span className="text-red-700">-{money(c.clawbackAmount)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <YesNo yes={c.cordobaChargeBack} tone="red" />
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClientSection({
  title,
  clients,
  empty,
}: {
  title: string;
  clients: ClientEvent[];
  empty: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">
        {title}{" "}
        <span className="text-sm font-normal text-zinc-500">({clients.length})</span>
      </h2>
      {clients.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2">{money(c.commissionOnClient)}</td>
                  <td className="px-3 py-2 text-zinc-500">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
