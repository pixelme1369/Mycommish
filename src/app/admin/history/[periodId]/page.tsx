import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { money } from "@/lib/portal/queries";
import { DeleteHistoryPeriodButton } from "@/app/admin/delete-history-period-button";
import { HistoryAgentsTable } from "../history-agents-table";

export const dynamic = "force-dynamic";

export default async function AdminHistoryPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireAdmin();
  const { periodId } = await params;

  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.history },
  });
  if (!period) notFound();

  const agents = await prisma.agentPeriod.findMany({
    where: { periodId },
    orderBy: [{ netCommission: "desc" }, { agentName: "asc" }],
  });

  const tableRows = agents.map((a) => ({
    id: a.id,
    agentName: a.agentName,
    unitsCleared: a.unitsCleared,
    adjustedTier: a.adjustedTier,
    rawTier: a.rawTier,
    cancellationPenaltyApplied: a.cancellationPenaltyApplied,
    tierRate: Number(a.tierRate),
    grossCommission: Number(a.grossCommission),
    clawbackAmount: Number(a.clawbackAmount),
    netCommission: Number(a.netCommission),
    cancellationRate: Number(a.cancellationRate),
  }));

  const totals = tableRows.reduce(
    (acc, a) => {
      acc.units += a.unitsCleared;
      acc.gross += a.grossCommission;
      acc.clawback += a.clawbackAmount;
      acc.net += a.netCommission;
      return acc;
    },
    { units: 0, gross: 0, clawback: 0, net: 0 },
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm text-zinc-500">
          <Link href="/admin" className="hover:underline">
            {adminHomeLinkLabel(session.user.role)}
          </Link>
        </p>
        <div className="flex items-center gap-4">
          <DeleteHistoryPeriodButton
            periodId={period.id}
            periodLabel={period.periodLabel}
            redirectTo="/admin"
          />
          <SignOutButton />
        </div>
      </div>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {period.periodLabel}{" "}
        <span className="text-lg font-normal text-zinc-500">history</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Audit / anti-double-pay only — agents never see this as owed
        {period.filename ? ` · ${period.filename}` : ""}
        {period.uploadedAt
          ? ` · uploaded ${period.uploadedAt.toISOString().slice(0, 10)}`
          : ""}
      </p>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Client <span className="font-medium">Rate</span> on paid rows is stored as{" "}
        <span className="font-medium">paidRate</span> for later CRM clawbacks (
        debt × rate). Gross/net here are ledger history, not live portal payout.
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agents" value={String(tableRows.length)} />
        <Stat label="Units paid" value={String(totals.units)} />
        <Stat label="Gross" value={money(totals.gross)} />
        <Stat label="Net" value={money(totals.net)} accent />
      </div>

      {tableRows.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">No agent rows for this history period.</p>
      ) : (
        <HistoryAgentsTable periodId={period.id} agents={tableRows} />
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
      <p className={`mt-1 text-lg ${accent ? "font-semibold text-money" : "font-medium"}`}>{value}</p>
    </div>
  );
}
