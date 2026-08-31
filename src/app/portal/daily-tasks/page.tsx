import { redirect } from "next/navigation";
import {
  isSuperAdminUser,
  requireSession,
  sessionRole,
} from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { Card } from "@/components/ui/card";
import { listDailyTasksForAgent } from "@/lib/portal/daily-tasks";
import { DailyTasksWorkspace } from "./daily-tasks-client";

export const dynamic = "force-dynamic";

export default async function DailyTasksPage() {
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
    />
  );

  if (!agentId) {
    return (
      <AppShell wide>
        {topBar}
        <header className="mt-8">
          <h1 className="font-heading text-2xl tracking-tight">Daily Tasks</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in required.</p>
        </header>
      </AppShell>
    );
  }

  const tasks = await listDailyTasksForAgent({ agentId, aliasNames });

  return (
    <AppShell wide>
      {topBar}

      <header className="mt-8">
        <h1 className="font-heading text-2xl tracking-tight text-foreground sm:text-[1.65rem]">
          Daily Tasks
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.user.displayName} · day-1 and day-5 enrollment follow-ups on your aliases
        </p>
      </header>

      {!aliasNames.length ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          Your login has no CRM name aliases yet. Ask an admin to map your Sales Rep name(s) in
          Manage Agents — Daily Tasks only lists files enrolled under your aliases.
        </Card>
      ) : (
        <div className="mt-6">
          <DailyTasksWorkspace
            day1={tasks.day1}
            day5={tasks.day5}
            day1Ymd={tasks.day1Ymd}
            day5Ymd={tasks.day5Ymd}
            todayYmd={tasks.todayYmd}
          />
        </div>
      )}
    </AppShell>
  );
}
