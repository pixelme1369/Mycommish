import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";
import {
  defaultOpenerPeriodLabel,
  listOpenerPayPeriodLabels,
  listOpenerSummaries,
} from "@/lib/opener/logs";
import { getOpenerPeriodView } from "@/lib/opener/period";
import { openerStatementStatusByAgent } from "@/lib/opener/statements";
import { OpenerSummaryTable } from "@/components/opener-summary-table";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import { OpenerPeriodLockBar } from "@/app/admin/openers/opener-period-lock-bar";

export const dynamic = "force-dynamic";

export default async function AdminOpenersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const { month: monthRaw } = await searchParams;
  const [periods, pendingManualBonusCount] = await Promise.all([
    listOpenerPayPeriodLabels(),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
  ]);
  const monthLabel = await defaultOpenerPeriodLabel(monthRaw);
  const [rows, periodView, signStatus] = await Promise.all([
    listOpenerSummaries(monthLabel),
    getOpenerPeriodView(monthLabel),
    openerStatementStatusByAgent(monthLabel),
  ]);

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
        description="Opener transfers · pick a pay period (same YYYY-MM as agents)"
        actions={
          <AdminTopNav
            isSuperAdmin={superAdmin}
            pendingManualBonusCount={pendingManualBonusCount}
            active="openers"
          />
        }
      />

      <div className="mt-8">
        <OpenerPeriodPicker
          periods={periods}
          selected={monthLabel}
          pathname="/admin/openers"
        />
        <OpenerPeriodLockBar
          monthLabel={monthLabel}
          closed={periodView.status === "closed"}
          paid={periodView.paid}
        />
        <OpenerSummaryTable
          rows={rows}
          detailBase="/admin/openers"
          monthLabel={monthLabel}
          canEditUpscore={!periodView.locked}
          locked={periodView.locked}
          signStatus={signStatus}
        />
      </div>
    </AppShell>
  );
}
