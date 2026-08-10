import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { ClientEventKind, PeriodSource } from "@/generated/prisma/client";
import { money, ratePercent } from "@/lib/portal/queries";
import type { ClientEvent } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminHistoryAgentPage({
  params,
}: {
  params: Promise<{ periodId: string; agentPeriodId: string }>;
}) {
  await requireAdmin();
  const { periodId, agentPeriodId } = await params;

  const row = await prisma.agentPeriod.findFirst({
    where: {
      id: agentPeriodId,
      periodId,
      period: { source: PeriodSource.history },
    },
    include: { period: true },
  });
  if (!row) notFound();

  const events = await prisma.clientEvent.findMany({
    where: { agentPeriodId: row.id },
    orderBy: [{ clientName: "asc" }, { crmId: "asc" }],
  });

  const paid = events.filter((e) => e.kind === ClientEventKind.history_paid || e.isCleared);
  const subtracted = events.filter(
    (e) =>
      e.kind === ClientEventKind.history_subtract ||
      (e.clawbackApplied && e.kind !== ClientEventKind.history_paid),
  );
  const paidIds = new Set(paid.map((e) => e.id));
  const subtractOnly = subtracted.filter((e) => !paidIds.has(e.id));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500">
          <Link href={`/admin/history/${periodId}`} className="hover:underline">
            ← {row.period.periodLabel} history
          </Link>
        </p>
        <SignOutButton />
      </div>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {row.agentName} · {row.period.periodLabel}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        History import (audit) · not shown to agents as owed
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Units paid" value={String(row.unitsCleared)} />
        <Stat label="Tier rate" value={ratePercent(row.tierRate)} />
        <Stat label="Gross" value={money(row.grossCommission)} />
        <Stat label="Net" value={money(row.netCommission)} accent />
        <Stat
          label="To subtract"
          value={Number(row.clawbackAmount) > 0 ? `-${money(row.clawbackAmount)}` : "—"}
        />
        <Stat label="Cleared debt" value={money(row.totalClearedDebt)} />
      </div>

      {row.notes ? (
        <p className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {row.notes}
        </p>
      ) : null}

      <HistoryClientSection
        title="Paid (anti-double-pay)"
        clients={paid}
        empty="No paid history clients."
        mode="paid"
      />
      <HistoryClientSection
        title="To subtract"
        clients={subtractOnly}
        empty="No subtract rows."
        mode="subtract"
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

function HistoryClientSection({
  title,
  clients,
  empty,
  mode,
}: {
  title: string;
  clients: ClientEvent[];
  empty: string;
  mode: "paid" | "subtract";
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">
        {title}{" "}
        <span className="text-sm font-normal text-zinc-500">({clients.length})</span>
      </h2>
      {mode === "paid" ? (
        <p className="mt-1 text-sm text-zinc-500">
          paidRate comes from the ledger Rate column when present — CRM clawbacks reuse it as
          debt × rate.
        </p>
      ) : null}
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
                {mode === "paid" ? (
                  <>
                    <th className="px-3 py-2 font-medium">paidRate</th>
                    <th className="px-3 py-2 font-medium">Commission</th>
                  </>
                ) : (
                  <th className="px-3 py-2 font-medium">Subtract</th>
                )}
                <th className="px-3 py-2 font-medium">Payments</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">{c.clientName || "—"}</td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  {mode === "paid" ? (
                    <>
                      <td className="px-3 py-2">
                        {c.paidRate != null ? ratePercent(c.paidRate) : "—"}
                      </td>
                      <td className="px-3 py-2">{money(c.commissionOnClient)}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2">
                      <span className="text-red-700">-{money(c.clawbackAmount)}</span>
                    </td>
                  )}
                  <td className="px-3 py-2">{c.paymentsMade}</td>
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
