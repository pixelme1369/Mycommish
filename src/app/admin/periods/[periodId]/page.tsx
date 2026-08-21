import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { money } from "@/lib/format";
import {
  dismissalKey,
  listDismissedKeys,
} from "@/lib/agents/dismissal";
import { DeletePeriodButton } from "@/app/admin/delete-period-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PeriodAgentsGustoTable } from "../period-agents-gusto-table";
import { listBonusesForPeriod } from "@/lib/manager-bonuses";
import { ManagerReimbursementsSection } from "@/components/manager-reimbursements-section";

export const dynamic = "force-dynamic";

export default async function AdminPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await requireAdmin();
  const { periodId } = await params;

  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) notFound();

  const [agents, dismissedKeys, bonusRows] = await Promise.all([
    prisma.agentPeriod.findMany({
      where: { periodId },
      orderBy: [{ netCommission: "desc" }, { agentName: "asc" }],
    }),
    listDismissedKeys(),
    listBonusesForPeriod(period.periodLabel).catch((err) => {
      console.error("listBonusesForPeriod failed", err);
      return [];
    }),
  ]);

  const tableRows = agents.map((a) => ({
    id: a.id,
    agentName: a.agentName,
    unitsCleared: a.unitsCleared,
    pendingUnits: a.pendingUnits,
    adjustedTier: a.adjustedTier,
    rawTier: a.rawTier,
    cancellationPenaltyApplied: a.cancellationPenaltyApplied,
    tierRate: Number(a.tierRate),
    grossCommission: Number(a.grossCommission),
    clawbackAmount: Number(a.clawbackAmount),
    netCommission: Number(a.netCommission),
    cancellationRate: Number(a.cancellationRate),
    dismissed: dismissedKeys.has(dismissalKey(a.agentName)),
  }));

  const activeRows = tableRows.filter((r) => !r.dismissed);
  const activeTotals = activeRows.reduce(
    (acc, a) => {
      acc.units += a.unitsCleared;
      acc.gross += Number(a.grossCommission);
      acc.clawback += Number(a.clawbackAmount);
      acc.net += Number(a.netCommission);
      return acc;
    },
    { units: 0, gross: 0, clawback: 0, net: 0 },
  );
  const dismissedCount = tableRows.length - activeRows.length;

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            {adminHomeLinkLabel(session.user.role)}
          </Link>
        }
        title={period.periodLabel}
        description={
          <>
            Status: {period.status} · calculated
            {period.filename ? ` · ${period.filename}` : ""}
            {period.uploadedAt
              ? ` · uploaded ${period.uploadedAt.toISOString().slice(0, 10)}`
              : ""}
            {dismissedCount > 0 ? ` · ${dismissedCount} dismissed hidden` : ""}
          </>
        }
        actions={
          <>
            <DeletePeriodButton periodId={period.id} periodLabel={period.periodLabel} />
            <SignOutButton />
          </>
        }
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agents" value={String(activeRows.length)} />
        <Stat label="Units cleared" value={String(activeTotals.units)} />
        <Stat label="Gross" value={money(activeTotals.gross)} />
        <Stat label="Net" value={money(activeTotals.net)} accent />
      </div>

      <ManagerReimbursementsSection
        periodLabel={period.periodLabel}
        rows={bonusRows}
        adminControls
      />

      {agents.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No agent rows for this period.</p>
      ) : (
        <PeriodAgentsGustoTable
          periodId={period.id}
          agents={tableRows}
          dismissedCount={dismissedCount}
        />
      )}
    </AppShell>
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
    <Card className="glass-panel px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-lg ${accent ? "font-semibold text-money" : "font-medium"}`}
      >
        {value}
      </p>
    </Card>
  );
}
