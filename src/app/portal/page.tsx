import Link from "next/link";
import { redirect } from "next/navigation";
import { isSuperAdminUser, requireSession } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
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

export const dynamic = "force-dynamic";

function formatPayDate(periodLabel: string): string {
  const d = paymentDateForPeriod(periodLabel);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function PortalHome() {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");
  const aliasNames = session.user.aliasNames || [];
  const windowPeriods = await latestCalculatedPeriods();
  const windowLabels = windowPeriods.map((p) => p.periodLabel);

  const rowSets = await Promise.all(aliasNames.map((n) => agentRowsForLatestPeriods(n)));
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

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· portal</span>
          </span>
        }
        title="My commissions"
        description={session.user.displayName}
        actions={
          <>
            <Link
              href="/portal/files"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              My files
            </Link>
            {session.user.isAdmin ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)} →
              </Link>
            ) : session.user.role === "manager" ? (
              <Link
                href="/manager"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Manager →
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      {!aliasNames.length ? (
        <Card className="glass-panel mt-10 p-6 text-sm text-muted-foreground">
          Your login has no CRM name aliases yet. Ask an admin to map your Sales Rep name(s) in
          Manage Agents.
        </Card>
      ) : unique.length === 0 ? (
        <Card className="glass-panel mt-10 p-6 text-sm text-muted-foreground">
          No activity in {windowLabels.join(" / ") || "the latest 2 periods"} for{" "}
          {aliasNames.join(", ")}.
        </Card>
      ) : (
        <>
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
        </>
      )}
    </AppShell>
  );
}
