import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isSuperAdminUser,
  requireSession,
  sessionRole,
} from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDailyTasksForAgent } from "@/lib/portal/daily-tasks";
import DailyTasksWorkspace from "./daily-tasks-client";

export const dynamic = "force-dynamic";

export default async function DailyTasksPage() {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");

  const agentId = session.user.agentId;
  const aliasNames = session.user.aliasNames || [];
  const role = sessionRole(session);
  const isManagerHome = role === "manager" || role === "admin";

  if (!agentId) {
    return (
      <AppShell wide>
        <PageHeader title="Daily Tasks" description="Sign in required." />
      </AppShell>
    );
  }

  const tasks = await listDailyTasksForAgent({ agentId, aliasNames });

  return (
    <AppShell wide>
      <PageHeader
        compact
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {isManagerHome ? "manager" : "portal"}</span>
          </span>
        }
        title="Daily Tasks"
        description={`${session.user.displayName} · day-3 and day-10 enrollment follow-ups on your aliases`}
        actions={
          <>
            <Link
              href={isManagerHome ? "/manager" : "/portal"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Commissions
            </Link>
            <Link
              href={isManagerHome ? "/manager/files" : "/portal/files"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {isManagerHome ? "All files" : "My files"}
            </Link>
            {session.user.isAdmin || role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : role === "manager" ? (
              <Link
                href="/manager"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Manager
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      {!aliasNames.length ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          Your login has no CRM name aliases yet. Ask an admin to map your Sales Rep name(s) in
          Manage Agents — Daily Tasks only lists files enrolled under your aliases.
        </Card>
      ) : (
        <DailyTasksWorkspace
          day3={tasks.day3}
          day10={tasks.day10}
          day3Ymd={tasks.day3Ymd}
          day10Ymd={tasks.day10Ymd}
          todayYmd={tasks.todayYmd}
        />
      )}
    </AppShell>
  );
}
