import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listEnrolledGoalsForAdmin } from "@/lib/portal/monthly-goal";
import { AgentGoalsRoster } from "@/components/agent-goals-roster";

export const dynamic = "force-dynamic";

export default async function ManagerGoalsPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const { monthTitle, rows } = await listEnrolledGoalsForAdmin();

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="Goals"
        description={`${monthTitle} · every agent’s enrolled goal and progress`}
        actions={
          <>
            <Link
              href="/manager"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Commissions
            </Link>
            <Link
              href="/manager/goals"
              aria-current="page"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              Goals
            </Link>
            <Link
              href="/manager/openers"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Openers
            </Link>
            <Link
              href="/portal/daily-tasks"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Daily Tasks
            </Link>
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />
      <AgentGoalsRoster monthTitle={monthTitle} rows={rows} />
    </AppShell>
  );
}
