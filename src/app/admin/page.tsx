import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { AdminCalculatedPeriods } from "./admin-calculated-periods";
import { AdminImportSection } from "./admin-import-section";
import { AdminSecondarySections } from "./admin-secondary-sections";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";
import { countActiveAgentsByPeriod } from "@/lib/agents/active-period-counts";
import {
  listForthMapUsers,
  listUnmatchedForthNames,
} from "@/lib/forth/unmatched";
import { UnmatchedForthPanel } from "@/app/admin/unmatched-forth-panel";

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

function toDashboardRow(
  p: PeriodRow,
  agentCount: number,
  historyPeriodId?: string | null,
) {
  return {
    id: p.id,
    periodLabel: p.periodLabel,
    status: p.status,
    agentCount,
    filename: p.filename,
    historyPeriodId: historyPeriodId ?? null,
  };
}

export default async function AdminHome() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [
    periodsRaw,
    historyPeriodsRaw,
    uploads,
    pendingManualBonusCount,
    unmatchedForth,
    forthMapUsers,
  ] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
    listUnmatchedForthNames().catch(() => []),
    listForthMapUsers().catch(() => []),
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
    .map((p) =>
      toDashboardRow(
        p,
        activeCounts.get(p.id) ?? 0,
        historyIdByLabel.get(p.periodLabel),
      ),
    );
  const closedPeriods = periods
    .filter((p) => p.status !== "open")
    .map((p) =>
      toDashboardRow(
        p,
        activeCounts.get(p.id) ?? 0,
        historyIdByLabel.get(p.periodLabel),
      ),
    );

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
          <AdminTopNav
            isSuperAdmin={superAdmin}
            pendingManualBonusCount={pendingManualBonusCount}
          />
        }
      />

      {unmatchedForth.length > 0 ? (
        <div className="mt-8">
          <UnmatchedForthPanel rows={unmatchedForth} users={forthMapUsers} />
        </div>
      ) : null}

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
