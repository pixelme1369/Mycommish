import Link from "next/link";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import {
  StatementsAwaitingManager,
  OpenerStatementsAwaitingManager,
} from "@/components/statements-awaiting-manager";
import { listStatementsAwaitingManager } from "@/lib/statements";
import { listOpenerStatementsAwaitingManager } from "@/lib/opener/statements";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";

export const dynamic = "force-dynamic";

export default async function AdminAwaitingSignaturesPage() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [awaitingManager, awaitingOpenerManager, pendingManualBonusCount] =
    await Promise.all([
      listStatementsAwaitingManager().catch(() => []),
      listOpenerStatementsAwaitingManager().catch(() => []),
      superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
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
        title="Awaiting signature"
        description="Statements waiting on a manager countersignature"
        actions={
          <>
            <AdminTopNav
              isSuperAdmin={superAdmin}
              pendingManualBonusCount={pendingManualBonusCount}
              active="documents"
            />
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {adminHomeLinkLabel(session.user.role)}
            </Link>
          </>
        }
      />

      <div className="mt-8 space-y-10">
        <StatementsAwaitingManager
          rows={awaitingManager}
          viewBase="/admin"
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
