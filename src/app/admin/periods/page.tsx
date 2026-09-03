import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { AdminCalculatedPeriods } from "@/app/admin/admin-calculated-periods";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
} from "@/app/admin/actions";
import { countActiveAgentsByPeriod } from "@/lib/agents/active-period-counts";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";

export const dynamic = "force-dynamic";

type PeriodRow = Awaited<ReturnType<typeof listCalculatedPeriods>>[number];

function sortPeriodsForDashboard(periods: PeriodRow[]) {
  return [...periods].sort((a, b) => {
    const openFirst = (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1);
    if (openFirst !== 0) return openFirst;
    if (a.periodLabel !== b.periodLabel) {
      return a.periodLabel < b.periodLabel ? 1 : -1;
    }
    const aTime = a.uploadedAt?.getTime() ?? 0;
    const bTime = b.uploadedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export default async function AdminAgentPeriodsPage() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [periodsRaw, historyPeriodsRaw, pendingManualBonusCount] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
  ]);
  const periods = sortPeriodsForDashboard(periodsRaw);
  const activeCounts = await countActiveAgentsByPeriod(
    periods.map((p) => ({ id: p.id, periodLabel: p.periodLabel })),
  );
  const historyIdByLabel = new Map(
    historyPeriodsRaw.map((h) => [h.periodLabel, h.id] as const),
  );

  const openPeriods = periods
    .filter((p) => p.status === "open")
    .map((p) => ({
      id: p.id,
      periodLabel: p.periodLabel,
      status: p.status,
      agentCount: activeCounts.get(p.id) ?? 0,
      filename: p.filename,
      historyPeriodId: historyIdByLabel.get(p.periodLabel) ?? null,
    }));
  const closedPeriods = periods
    .filter((p) => p.status !== "open")
    .map((p) => ({
      id: p.id,
      periodLabel: p.periodLabel,
      status: p.status,
      agentCount: activeCounts.get(p.id) ?? 0,
      filename: p.filename,
      historyPeriodId: historyIdByLabel.get(p.periodLabel) ?? null,
    }));

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {session.user.displayName}</span>
          </span>
        }
        title={`${adminNavLabel(session.user.role)} · Agent commissions`}
        description="Open a pay period to review and pay agents"
        actions={
          <AdminTopNav
            isSuperAdmin={superAdmin}
            pendingManualBonusCount={pendingManualBonusCount}
            active="commissions"
          />
        }
      />

      <div className="mt-8">
        <AdminCalculatedPeriods
          openPeriods={openPeriods}
          closedPeriods={closedPeriods}
        />
      </div>
    </AppShell>
  );
}
