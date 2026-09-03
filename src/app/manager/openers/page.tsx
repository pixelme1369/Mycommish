import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  defaultOpenerPeriodLabel,
  listOpenerPayPeriodLabels,
  listOpenerSummaries,
} from "@/lib/opener/logs";
import { OpenerSummaryTable } from "@/components/opener-summary-table";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";
import { getOpenerPeriodView } from "@/lib/opener/period";
import { openerStatementStatusByAgent } from "@/lib/opener/statements";

export const dynamic = "force-dynamic";

export default async function ManagerOpenersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const { month: monthRaw } = await searchParams;
  const [periods, monthLabel] = await Promise.all([
    listOpenerPayPeriodLabels(),
    defaultOpenerPeriodLabel(monthRaw),
  ]);
  const rows = await listOpenerSummaries(monthLabel);
  const [periodView, signStatus] = await Promise.all([
    getOpenerPeriodView(monthLabel),
    openerStatementStatusByAgent(monthLabel),
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
        title="Opener commissions"
        description="Pick a pay period · same YYYY-MM and payday as agents"
        actions={
          <>
            <ManagerTopNav
              active="openers"
              showAgentPortal={Boolean(session.user.agentId)}
            />
            {role === "admin" ? (
              <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mt-8">
        <OpenerPeriodPicker
          periods={periods}
          selected={monthLabel}
          pathname="/manager/openers"
        />
        <OpenerSummaryTable
          rows={rows}
          detailBase="/manager/openers"
          monthLabel={monthLabel}
          canEditUpscore={!periodView.locked}
          locked={periodView.locked}
          signStatus={signStatus}
        />
      </div>
    </AppShell>
  );
}
