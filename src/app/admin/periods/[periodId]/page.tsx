import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { cancelRatePercent, money, ratePercent } from "@/lib/portal/queries";
import { DeletePeriodButton } from "@/app/admin/delete-period-button";

export const dynamic = "force-dynamic";

export default async function AdminPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  await requireAdmin();
  const { periodId } = await params;

  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) notFound();

  const agents = await prisma.agentPeriod.findMany({
    where: { periodId },
    orderBy: [{ netCommission: "desc" }, { agentName: "asc" }],
  });

  const totals = agents.reduce(
    (acc, a) => {
      acc.units += a.unitsCleared;
      acc.gross += Number(a.grossCommission);
      acc.clawback += Number(a.clawbackAmount);
      acc.net += Number(a.netCommission);
      return acc;
    },
    { units: 0, gross: 0, clawback: 0, net: 0 },
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500">
          <Link href="/admin" className="hover:underline">
            ← Admin
          </Link>
        </p>
        <div className="flex items-center gap-4">
          <DeletePeriodButton periodId={period.id} periodLabel={period.periodLabel} />
          <SignOutButton />
        </div>
      </div>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {period.periodLabel}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Status: {period.status} · calculated
        {period.filename ? ` · ${period.filename}` : ""}
        {period.uploadedAt
          ? ` · uploaded ${period.uploadedAt.toISOString().slice(0, 10)}`
          : ""}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agents" value={String(agents.length)} />
        <Stat label="Units cleared" value={String(totals.units)} />
        <Stat label="Gross" value={money(totals.gross)} />
        <Stat label="Net" value={money(totals.net)} accent />
      </div>

      {agents.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">No agent rows for this period.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Units</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Clawback</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Cancel %</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {agents.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{r.agentName}</td>
                  <td className="px-4 py-3">{r.unitsCleared}</td>
                  <td className="px-4 py-3">
                    {r.cancellationPenaltyApplied
                      ? `${r.rawTier}→${r.adjustedTier}`
                      : r.adjustedTier || "—"}
                  </td>
                  <td className="px-4 py-3">{ratePercent(r.tierRate)}</td>
                  <td className="px-4 py-3">{money(r.grossCommission)}</td>
                  <td className="px-4 py-3">
                    {Number(r.clawbackAmount) > 0 ? (
                      <span className="text-red-700">-{money(r.clawbackAmount)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(r.netCommission)}</td>
                  <td className="px-4 py-3">{cancelRatePercent(r.cancellationRate)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/period/${period.id}/agent/${r.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      Clients →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
