import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listEnrolledGoalsForAdmin } from "@/lib/portal/monthly-goal";
import { AgentGoalsRoster } from "@/components/agent-goals-roster";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagerGoalsPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const [{ monthTitle, rows }, pendingClaims] = await Promise.all([
    listEnrolledGoalsForAdmin(),
    prisma.fileClaim
      .count({ where: { status: FileClaimStatus.pending } })
      .catch(() => 0),
  ]);

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
            <ManagerTopNav
              active="goals"
              pendingClaims={pendingClaims}
              showAgentPortal={Boolean(session.user.agentId)}
            />
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
          </>
        }
      />
      <AgentGoalsRoster monthTitle={monthTitle} rows={rows} />
    </AppShell>
  );
}
