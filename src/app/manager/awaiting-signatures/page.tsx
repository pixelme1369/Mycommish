import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";
import {
  StatementsAwaitingManager,
  OpenerStatementsAwaitingManager,
} from "@/components/statements-awaiting-manager";
import { listStatementsAwaitingManager } from "@/lib/statements";
import { listOpenerStatementsAwaitingManager } from "@/lib/opener/statements";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagerAwaitingSignaturesPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const agentId = session.user.agentId;
  const [awaitingManager, awaitingOpenerManager, pendingClaims] =
    await Promise.all([
      listStatementsAwaitingManager().catch(() => []),
      listOpenerStatementsAwaitingManager().catch(() => []),
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
        title="Awaiting signature"
        description="Statements waiting on a manager countersignature"
        actions={
          <>
            <ManagerTopNav
              active="documents"
              pendingClaims={pendingClaims}
              showAgentPortal={Boolean(agentId)}
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

      <div className="mt-8 space-y-10">
        <StatementsAwaitingManager
          rows={awaitingManager}
          viewBase="/manager"
          title="Agents"
          description="Agents who signed their commission statement and need a countersignature."
        />
        <OpenerStatementsAwaitingManager
          rows={awaitingOpenerManager}
          title="Openers"
          description="Openers who signed their commission statement and need a countersignature."
        />
      </div>
    </AppShell>
  );
}
