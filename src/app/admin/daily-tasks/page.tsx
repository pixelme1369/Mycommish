import Link from "next/link";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminHomeLinkLabel, adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDailyTasksForAdmin } from "@/lib/portal/daily-tasks";
import AdminDailyTasksWorkspace from "./admin-daily-tasks-client";

export const dynamic = "force-dynamic";

export default async function AdminDailyTasksPage() {
  const session = await requireAdmin();
  const tasks = await listDailyTasksForAdmin();

  return (
    <AppShell wide>
      <PageHeader
        compact
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {adminNavLabel(session.user.role)}</span>
          </span>
        }
        title="Daily Tasks"
        description="All agents · day-3 and day-10 follow-ups · who completed Email / SMS / Call"
        actions={
          <>
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {adminHomeLinkLabel(session.user.role)}
            </Link>
            {!isSuperAdminUser(session) ? (
              <Link
                href="/portal/daily-tasks"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                My tasks
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <AdminDailyTasksWorkspace
        day3={tasks.day3}
        day10={tasks.day10}
        todayYmd={tasks.todayYmd}
      />
    </AppShell>
  );
}
