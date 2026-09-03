import Link from "next/link";
import { requireManagerOrAdmin, isAdminUser } from "@/lib/auth-guards";
import { formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileClaimsQueue } from "@/components/file-claims-queue";
import { loadFileClaimsQueueData } from "@/lib/claims/load-queue";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";

export const dynamic = "force-dynamic";

export default async function ManagerClaimsPage() {
  const session = await requireManagerOrAdmin();
  const admin = isAdminUser(session);
  const { claims, pendingCount, identityByClaimId, eventByCrm } =
    await loadFileClaimsQueueData();

  return (
    <AppShell wide className="max-w-[100rem]">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="File claims"
        description={
          <>
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="mr-2 font-normal">
                {pendingCount} pending
              </Badge>
            ) : null}
            Review agent claims · Accept locks Sales Rep for future CRM + moves
            open-period rows (incl. dropped/clawback); closed periods stay locked
          </>
        }
        actions={
          <>
            <ManagerTopNav
              active="claims"
              pendingClaims={pendingCount}
              showAgentPortal={Boolean(session.user.agentId)}
            />
            {admin ? (
              <Link
                href="/admin/claims"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Admin claims
              </Link>
            ) : null}
          </>
        }
      />

      <FileClaimsQueue
        claims={claims}
        identityByClaimId={identityByClaimId}
        eventByCrm={eventByCrm}
      />
    </AppShell>
  );
}
