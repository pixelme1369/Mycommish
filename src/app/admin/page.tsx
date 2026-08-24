import Link from "next/link";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminCalculatedPeriods } from "./admin-calculated-periods";
import { AdminImportSection } from "./admin-import-section";
import { AdminSecondarySections } from "./admin-secondary-sections";
import { StatementsAwaitingManager } from "@/components/statements-awaiting-manager";
import { listStatementsAwaitingManager } from "@/lib/statements";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";
import { countActiveAgentsByPeriod } from "@/lib/agents/active-period-counts";

export const dynamic = "force-dynamic";

type PeriodRow = Awaited<ReturnType<typeof listCalculatedPeriods>>[number];

/** Newest month first; open periods before closed. */
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

function groupByFilename(periods: PeriodRow[]) {
  const map = new Map<string, PeriodRow[]>();
  for (const p of periods) {
    const key = p.filename?.trim() || "(no filename)";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([filename, group]) => [filename, sortPeriodsForDashboard(group)] as const)
    .sort((a, b) => {
      const aTop = a[1][0]?.periodLabel ?? "";
      const bTop = b[1][0]?.periodLabel ?? "";
      if (aTop === bTop) return 0;
      return aTop < bTop ? 1 : -1;
    });
}

function toDashboardRow(p: PeriodRow, agentCount: number) {
  return {
    id: p.id,
    periodLabel: p.periodLabel,
    status: p.status,
    agentCount,
    filename: p.filename,
  };
}

export default async function AdminHome() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [
    periodsRaw,
    historyPeriodsRaw,
    uploads,
    awaitingManager,
    pendingManualBonusCount,
  ] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
    listStatementsAwaitingManager().catch(() => []),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
  ]);
  const periods = sortPeriodsForDashboard(periodsRaw);
  const activeCounts = await countActiveAgentsByPeriod(
    periods.map((p) => ({ id: p.id, periodLabel: p.periodLabel })),
  );
  const openPeriods = periods
    .filter((p) => p.status === "open")
    .map((p) => toDashboardRow(p, activeCounts.get(p.id) ?? 0));
  const closedPeriods = periods
    .filter((p) => p.status !== "open")
    .map((p) => toDashboardRow(p, activeCounts.get(p.id) ?? 0));

  const historyPeriods = [...historyPeriodsRaw].sort((a, b) =>
    a.periodLabel < b.periodLabel ? 1 : a.periodLabel > b.periodLabel ? -1 : 0,
  );
  const historyGroups = groupByFilename(historyPeriods).map(([filename, group]) => ({
    filename,
    periods: group.map((p) => ({
      id: p.id,
      periodLabel: p.periodLabel,
      agentCount: p._count.agentPeriods,
    })),
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
        title={adminNavLabel(session.user.role)}
        description="Open a period to pay · import only when files are ready"
        actions={
          <>
            <Link
              href="/manager/advances"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Advances
            </Link>
            <Link
              href="/admin/claims"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              File claims
            </Link>
            <Link
              href="/admin/statements"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Signed PDFs
            </Link>
            <Link
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Users
            </Link>
            {superAdmin ? (
              <>
                <Link
                  href="/superadmin/team-leads"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Team leads
                </Link>
                <Link
                  href="/superadmin/manual-bonuses"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Manual bonuses
                  {pendingManualBonusCount > 0 ? ` (${pendingManualBonusCount})` : ""}
                </Link>
              </>
            ) : (
              <Link
                href="/portal"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Portal
              </Link>
            )}
            <Link
              href="/manager"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manager view
            </Link>
            <SignOutButton />
          </>
        }
      />

      <div className="mt-8">
        <StatementsAwaitingManager rows={awaitingManager} viewBase="/admin" />
      </div>

      <div className="mt-8">
        <AdminCalculatedPeriods
          openPeriods={openPeriods}
          closedPeriods={closedPeriods}
        />
      </div>

      <div className="mt-12">
        <AdminImportSection />
      </div>

      <div className="mt-12">
        <AdminSecondarySections
          historyGroups={historyGroups}
          historyCount={historyPeriods.length}
          uploads={uploads.slice(0, 8).map((u) => ({
            id: u.id,
            type: u.type,
            filename: u.filename,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </AppShell>
  );
}
