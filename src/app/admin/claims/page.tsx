import Link from "next/link";
import {
  isAdminUser,
  isSuperAdminUser,
  requireManagerOrAdmin,
} from "@/lib/auth-guards";
import { adminHomeLinkLabel, formatRoleLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClearAllClaimsButton } from "./clear-all-claims-button";
import { FileClaimsQueue } from "@/components/file-claims-queue";
import { loadFileClaimsQueueData } from "@/lib/claims/load-queue";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const session = await requireManagerOrAdmin();
  const admin = isAdminUser(session);
  const superAdmin = isSuperAdminUser(session);
  const { claims, pendingCount, totalClaimCount, identityByClaimId, eventByCrm } =
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
        title="File claims · Agent"
        description={`${pendingCount} pending · External ID (= Cordoba ID) · Accept locks Sales Rep for future CRM + moves open-period rows (incl. dropped/clawback); closed periods stay locked`}
        actions={
          <>
            {admin ? <ClearAllClaimsButton claimCount={totalClaimCount} /> : null}
            {superAdmin ? (
              <Link
                href="/admin/opener-claims"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Openers
              </Link>
            ) : null}
            <Link
              href={admin ? "/admin" : "/manager"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {admin ? adminHomeLinkLabel(session.user.role) : "← Manager"}
            </Link>
            {!admin ? (
              <Link
                href="/manager/claims"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Manager view
              </Link>
            ) : null}
            <SignOutButton />
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
