import { isSuperAdminUser, requireAdmin } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { AdminGoalSettings } from "@/app/admin/admin-goal-settings";
import { loadGoalClearRatePct } from "@/lib/portal/goal-settings";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";

export const dynamic = "force-dynamic";

export default async function AdminManualInputsPage() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [clearRatePct, pendingManualBonusCount] = await Promise.all([
    loadGoalClearRatePct(),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
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
        description="Manual inputs · goals apply to every agent"
        actions={
          <AdminTopNav
            isSuperAdmin={superAdmin}
            pendingManualBonusCount={pendingManualBonusCount}
            active="manual-inputs"
          />
        }
      />

      <div className="mt-8 max-w-xl">
        <AdminGoalSettings clearRatePct={clearRatePct} />
      </div>
    </AppShell>
  );
}
