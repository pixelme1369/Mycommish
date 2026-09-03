import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser, requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import {
  defaultOpenerPeriodLabel,
  listOpenerLogsForAgent,
  listOpenerPayPeriodLabels,
} from "@/lib/opener/logs";
import { OpenerDetailTable } from "@/app/admin/openers/opener-detail-table";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";
import { getOpenerPeriodView } from "@/lib/opener/period";
import {
  getOpenerStatement,
  openerStatementViewFromRow,
} from "@/lib/opener/statements";
import { StatementSignPanel } from "@/app/portal/period/[periodId]/agent/[agentPeriodId]/statement-sign-panel";

export const dynamic = "force-dynamic";

export default async function ManagerOpenerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const { agentId } = await params;
  const { month: monthRaw } = await searchParams;
  const [monthLabel, periods] = await Promise.all([
    defaultOpenerPeriodLabel(monthRaw),
    listOpenerPayPeriodLabels(),
  ]);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, displayName: true },
  });
  if (!agent) notFound();

  const logs = await listOpenerLogsForAgent(agentId, monthLabel);
  const [periodView, statement] = await Promise.all([
    getOpenerPeriodView(monthLabel),
    getOpenerStatement(agentId, monthLabel).then(openerStatementViewFromRow),
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
        title={agent.displayName}
        description="Opener transfer log"
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
          pathname={`/manager/openers/${agentId}`}
        />
        <OpenerDetailTable
          canEditPayStatus={isAdminUser(session) && !periodView.locked}
          locked={periodView.locked}
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
        <StatementSignPanel
          className="mt-6"
          kind="opener"
          openerAgentId={agentId}
          periodLabel={monthLabel}
          role="manager"
          lockedName={session.user.displayName || ""}
          status={statement.status}
          agentSignedAt={statement.agentSignedAt}
          agentTypedName={statement.agentTypedName}
          managerSignedAt={statement.managerSignedAt}
          managerTypedName={statement.managerTypedName}
          canReset
        />
      </div>
    </AppShell>
  );
}
