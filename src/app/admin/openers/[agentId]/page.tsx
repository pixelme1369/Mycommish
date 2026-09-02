import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { AdminTopNav } from "@/app/admin/admin-top-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { countPendingManualBonuses } from "@/lib/manual-bonuses";
import {
  defaultOpenerPeriodLabel,
  listOpenerLogsForAgent,
  listOpenerPayPeriodLabels,
} from "@/lib/opener/logs";
import { OpenerDetailTable } from "@/app/admin/openers/opener-detail-table";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";

export const dynamic = "force-dynamic";

export default async function AdminOpenerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const { agentId } = await params;
  const { month: monthRaw } = await searchParams;
  const [monthLabel, periods] = await Promise.all([
    defaultOpenerPeriodLabel(monthRaw),
    listOpenerPayPeriodLabels(),
  ]);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, displayName: true, role: true },
  });
  if (!agent) notFound();

  const [logs, pendingManualBonusCount] = await Promise.all([
    listOpenerLogsForAgent(agentId, monthLabel),
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
        title={agent.displayName}
        description={`${adminNavLabel(session.user.role)} · opener transfer log`}
        actions={
          <AdminTopNav
            isSuperAdmin={superAdmin}
            pendingManualBonusCount={pendingManualBonusCount}
            active="openers"
          />
        }
      />

      <p className="mt-4">
        <Link
          href={`/admin/openers?month=${monthLabel}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ← All openers
        </Link>
      </p>

      <div className="mt-4">
        <OpenerPeriodPicker
          periods={periods}
          selected={monthLabel}
          pathname={`/admin/openers/${agentId}`}
        />
        <OpenerDetailTable
          canEditPayStatus
          rows={logs.map((r) => ({
            id: r.id,
            transferYmd: r.transferYmd,
            forthId: r.forthId,
            debtLoad: Number(r.debtLoad),
            stageTitle: r.stageTitle,
            status: r.status,
            commission: Number(r.commission),
            payStatus: r.payStatus,
            payStatusOverridden: r.payStatusOverridden,
            unmatched: r.unmatched,
            notes: r.notes,
          }))}
        />
      </div>
    </AppShell>
  );
}
