import { requireSuperAdmin } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";
import { listEnrolledGoalsForAdmin } from "@/lib/portal/monthly-goal";
import { AgentGoalsRoster } from "@/components/agent-goals-roster";

export const dynamic = "force-dynamic";

export default async function SuperAdminGoalsPage() {
  const session = await requireSuperAdmin();
  const [{ monthTitle, rows }, pendingManualBonusCount] = await Promise.all([
    listEnrolledGoalsForAdmin(),
    countPendingManualBonuses().catch(() => 0),
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
        description={`${monthTitle} · every agent’s enrolled goal and progress`}
        actions={
          <AdminTopNav
            isSuperAdmin
            pendingManualBonusCount={pendingManualBonusCount}
            active="goals"
          />
        }
      />
      <AgentGoalsRoster monthTitle={monthTitle} rows={rows} />
    </AppShell>
  );
}
