import { redirect } from "next/navigation";
import { isSuperAdminUser, requireSession, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, isOpenerRole } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { MonthlyGoalDashboard } from "@/app/portal/monthly-goal-card";
import { loadEnrolledGoal } from "@/lib/portal/monthly-goal";
import { pickCommissionAgentName } from "@/lib/portal/goal-tier-estimate";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");

  const agentId = session.user.agentId;
  const aliasNames = session.user.aliasNames || [];
  const role = sessionRole(session);
  const isManagerHome = role === "manager" || role === "admin";

  const staffHref =
    session.user.isAdmin || role === "admin"
      ? "/admin"
      : role === "manager"
        ? "/manager"
        : undefined;
  const staffLabel =
    session.user.isAdmin || role === "admin"
      ? `${adminNavLabel(session.user.role)} →`
      : role === "manager"
        ? "Manager →"
        : undefined;

  const topBar = (
    <PortalTopBar
      commissionsHref={isManagerHome ? "/manager" : "/portal"}
      filesHref={isManagerHome ? "/manager/files" : "/portal/files"}
      staffHref={staffHref}
      staffLabel={staffLabel}
      opener={isOpenerRole(session.user.role)}
      openersHref={isManagerHome ? "/manager/openers" : undefined}
    />
  );

  if (!agentId) {
    return (
      <AppShell wide>
        {topBar}
        <header className="mt-8">
          <h1 className="font-heading text-2xl tracking-tight">Goals</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in required.</p>
        </header>
      </AppShell>
    );
  }

  const view = await loadEnrolledGoal({ agentId, aliasNames });

  return (
    <AppShell wide>
      {topBar}
      <div className="mt-10">
        <MonthlyGoalDashboard
          view={view}
          agentName={pickCommissionAgentName(aliasNames)}
          showPayPreview={!isOpenerRole(session.user.role)}
        />
      </div>
    </AppShell>
  );
}
