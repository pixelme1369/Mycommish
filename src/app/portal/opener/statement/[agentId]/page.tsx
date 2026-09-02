import { notFound } from "next/navigation";
import { requireSession, canViewAllCommissions } from "@/lib/auth-guards";
import { isOpenerRole } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { AgentRole } from "@/generated/prisma/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { defaultOpenerPeriodLabel } from "@/lib/opener/logs";
import {
  getOpenerStatement,
  openerStatementViewFromRow,
} from "@/lib/opener/statements";
import { StatementSignPanel } from "@/app/portal/period/[periodId]/agent/[agentPeriodId]/statement-sign-panel";

export const dynamic = "force-dynamic";

export default async function OpenerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const { agentId } = await params;
  const { month: monthRaw } = await searchParams;
  const monthLabel = await defaultOpenerPeriodLabel(monthRaw);

  const staff = canViewAllCommissions(session);
  const own = isOpenerRole(session.user.role) && session.user.agentId === agentId;
  if (!staff && !own) notFound();

  const opener = await prisma.agent.findFirst({
    where: { id: agentId, role: AgentRole.opener },
    select: { id: true, displayName: true },
  });
  if (!opener) notFound();

  const statement = openerStatementViewFromRow(
    await getOpenerStatement(agentId, monthLabel),
  );
  const signRole = own && !staff ? "agent" : staff ? "manager" : "agent";
  const canReset = staff || (own && statement.status !== "fully_signed");

  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· opener statement</span>
          </span>
        }
        title={opener.displayName}
        description={`${monthLabel} commission statement`}
      />
      <StatementSignPanel
        className="mt-6"
        kind="opener"
        openerAgentId={agentId}
        periodLabel={monthLabel}
        role={signRole}
        lockedName={session.user.displayName || ""}
        status={statement.status}
        agentSignedAt={statement.agentSignedAt}
        agentTypedName={statement.agentTypedName}
        managerSignedAt={statement.managerSignedAt}
        managerTypedName={statement.managerTypedName}
        canReset={canReset}
      />
    </AppShell>
  );
}
