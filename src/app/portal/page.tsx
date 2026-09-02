import Link from "next/link";
import { redirect } from "next/navigation";
import { isSuperAdminUser, requireSession } from "@/lib/auth-guards";
import { adminNavLabel, isOpenerRole } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { paymentDateForPeriod } from "@/lib/commission/calculator";
import {
  agentRowsForLatestPeriods,
  cancelRatePercent,
  latestCalculatedPeriods,
  money,
  paidPeriodLabels,
  ratePercent,
} from "@/lib/portal/queries";
import { fullySignedAgentPeriodIds } from "@/lib/statements";
import { PeriodPayStatusChip } from "@/components/period-pay-status-chip";
import { AgentPhoneForm } from "@/app/portal/agent-phone-form";
import { prisma } from "@/lib/db";
import { pacificTodayYmd } from "@/lib/portal/daily-tasks-dates";
import {
  defaultOpenerPeriodLabel,
  listOpenerLogsForAgent,
  listOpenerPayPeriodLabels,
} from "@/lib/opener/logs";
import { OpenerTransfersPanel } from "@/app/portal/opener-log-panel";
import { getOpenerPeriodView } from "@/lib/opener/period";
import {
  getOpenerStatement,
  openerStatementViewFromRow,
} from "@/lib/opener/statements";
import { StatementSignPanel } from "@/app/portal/period/[periodId]/agent/[agentPeriodId]/statement-sign-panel";

export const dynamic = "force-dynamic";

function formatPayDate(periodLabel: string): string {
  const d = paymentDateForPeriod(periodLabel);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName || "there";
}

function dayGreeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Los_Angeles",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");
  const { month: monthRaw } = await searchParams;
  const aliasNames = session.user.aliasNames || [];
  const windowPeriods = await latestCalculatedPeriods();
  const windowLabels = windowPeriods.map((p) => p.periodLabel);

  const agentId = session.user.agentId;
  const agentProfile = agentId
    ? await prisma.agent.findUnique({
        where: { id: agentId },
        select: { phone: true },
      })
    : null;
  const phone = agentProfile?.phone?.trim() || null;
  const needsPhone = !phone;
  const opener = isOpenerRole(session.user.role);
  const [openerMonth, openerPeriods] = opener
    ? await Promise.all([
        defaultOpenerPeriodLabel(monthRaw),
        listOpenerPayPeriodLabels(),
      ])
    : ["", [] as string[]];
  const openerLogs =
    opener && agentId ? await listOpenerLogsForAgent(agentId, openerMonth) : [];
  const openerPeriodView =
    opener && openerMonth ? await getOpenerPeriodView(openerMonth) : null;
  const openerStatement =
    opener && agentId && openerMonth
      ? openerStatementViewFromRow(await getOpenerStatement(agentId, openerMonth))
      : null;

  const rowSets = opener
    ? []
    : await Promise.all(aliasNames.map((n) => agentRowsForLatestPeriods(n)));
  const rows = rowSets.flatMap((s) => s.rows);
  const seen = new Set<string>();
  const unique = rows
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => b.period.periodLabel.localeCompare(a.period.periodLabel));

  const paidLabels = await paidPeriodLabels(unique.map((r) => r.period.periodLabel));
  const fullySignedIds = await fullySignedAgentPeriodIds(
    unique.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      periodLabel: r.period.periodLabel,
    })),
  );

  const staffHref = session.user.isAdmin
    ? "/admin"
    : session.user.role === "manager"
      ? "/manager"
      : undefined;
  const staffLabel = session.user.isAdmin
    ? `${adminNavLabel(session.user.role)} →`
    : session.user.role === "manager"
      ? "Manager →"
      : undefined;

  const latest = unique[0];
  let subtitle: string;
  if (opener) {
    subtitle =
      "Log transfers by File ID. Pay is the 25th of the next month — same payday as agents.";
  } else if (!aliasNames.length) {
    subtitle = "Ask an admin to map your Sales Rep name(s) to see commissions.";
  } else if (!latest) {
    subtitle = `No activity in ${windowLabels.join(" / ") || "the latest 2 periods"}.`;
  } else {
    subtitle = `${latest.period.periodLabel} · Net ${money(latest.netCommission)}`;
  }

  return (
    <AppShell wide>
      <PortalTopBar
        staffHref={staffHref}
        staffLabel={staffLabel}
        opener={opener}
        openersHref={staffHref === "/manager" || staffHref === "/admin" ? "/manager/openers" : undefined}
      />

      <header className="mt-8">
        <h1 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
          {dayGreeting()}, {firstName(session.user.displayName)}!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      </header>

      {opener ? (
        <>
          {openerPeriodView ? (
            <div className="mt-4">
              <PeriodPayStatusChip
                paid={openerPeriodView.paid}
                pendingPayout={
                  openerStatement?.status === "fully_signed" && !openerPeriodView.paid
                }
              />
            </div>
          ) : null}
          <OpenerTransfersPanel
            todayYmd={pacificTodayYmd()}
            monthLabel={openerMonth}
            periods={openerPeriods}
            locked={openerPeriodView?.locked ?? false}
            rows={openerLogs.map((r) => ({
              id: r.id,
              transferYmd: r.transferYmd,
              forthId: r.forthId,
              debtLoad: Number(r.debtLoad),
              stageTitle: r.stageTitle,
              status: r.status,
              commission: Number(r.commission),
              payStatus: r.payStatus,
              unmatched: r.unmatched,
              notes: r.notes,
            }))}
          />
          {agentId && openerStatement ? (
            <StatementSignPanel
              className="mt-6"
              kind="opener"
              openerAgentId={agentId}
              periodLabel={openerMonth}
              role="agent"
              lockedName={session.user.displayName || ""}
              status={openerStatement.status}
              agentSignedAt={openerStatement.agentSignedAt}
              agentTypedName={openerStatement.agentTypedName}
              managerSignedAt={openerStatement.managerSignedAt}
              managerTypedName={openerStatement.managerTypedName}
              canReset={openerStatement.status !== "fully_signed"}
            />
          ) : null}
        </>
      ) : !aliasNames.length ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          Your login has no CRM name aliases yet. Ask an admin to map your Sales Rep name(s) in
          Manage Agents.
        </Card>
      ) : unique.length === 0 ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          No activity in {windowLabels.join(" / ") || "the latest 2 periods"} for{" "}
          {aliasNames.join(", ")}.
        </Card>
      ) : (
        <Card className="glass-panel mt-8 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Period</TableHead>
                <TableHead>Pay date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Clawback</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Cancel %</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {unique.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {r.period.periodLabel}
                      <PeriodPayStatusChip
                        paid={paidLabels.has(r.period.periodLabel)}
                        pendingPayout={fullySignedIds.has(r.id)}
                      />
                    </span>
                  </TableCell>
                  <TableCell>{formatPayDate(r.period.periodLabel)}</TableCell>
                  <TableCell>{r.agentName}</TableCell>
                  <TableCell>{r.unitsCleared}</TableCell>
                  <TableCell>
                    {r.cancellationPenaltyApplied
                      ? `${r.rawTier}→${r.adjustedTier}`
                      : r.adjustedTier || "—"}
                  </TableCell>
                  <TableCell>{ratePercent(r.tierRate)}</TableCell>
                  <TableCell>{money(r.grossCommission)}</TableCell>
                  <TableCell>
                    {Number(r.clawbackAmount) > 0 ? (
                      <span className="text-destructive">-{money(r.clawbackAmount)}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-money text-money-foreground hover:bg-money/90">
                      {money(r.netCommission)}
                    </Badge>
                  </TableCell>
                  <TableCell>{cancelRatePercent(r.cancellationRate)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/portal/period/${r.periodId}/agent/${r.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {needsPhone ? <AgentPhoneForm currentPhone={phone} /> : null}
    </AppShell>
  );
}
