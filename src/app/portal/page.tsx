import Link from "next/link";
import { requireSession } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { NextTierCard } from "@/components/next-tier-card";
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
import {
  commissionGainAtNextTier,
  getFixedRate,
  unitsToNextTier,
} from "@/lib/commission/calculator";
import {
  agentRowsForLatestPeriods,
  cancelRatePercent,
  latestCalculatedPeriods,
  money,
  ratePercent,
} from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await requireSession();
  const aliasNames = session.user.aliasNames || [];
  const windowPeriods = await latestCalculatedPeriods();
  const windowLabels = windowPeriods.map((p) => p.periodLabel);
  const latestLabel = windowPeriods[0]?.periodLabel;

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

  const latestRows = latestLabel
    ? unique.filter((r) => r.period.periodLabel === latestLabel)
    : [];

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· portal</span>
          </span>
        }
        title="Upcoming commissions"
        description={
          <>
            {session.user.displayName}
            {windowLabels.length > 0 ? (
              <>
                {" "}
                · latest 2 calculated:{" "}
                <span className="font-medium text-foreground">{windowLabels.join(", ")}</span>
              </>
            ) : null}
          </>
        }
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
                Admin →
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
          {latestRows.length > 0 ? (
            <div
              className={cn(
                "mt-8 grid gap-3",
                latestRows.length === 1
                  ? "sm:grid-cols-2 lg:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {latestRows.map((r) => {
                const unitsNeeded = unitsToNextTier(r.unitsCleared, r.agentName);
                const gain = commissionGainAtNextTier(
                  r.adjustedTier,
                  Number(r.totalClearedDebt),
                  Number(r.grossCommission),
                  r.agentName,
                );
                return (
                  <NextTierCard
                    key={`tier-${r.id}`}
                    agentName={latestRows.length > 1 ? r.agentName : undefined}
                    periodLabel={r.period.periodLabel}
                    unitsNeeded={unitsNeeded}
                    gain={gain}
                    atTopTier={r.adjustedTier >= 6}
                    fixedRate={getFixedRate(r.agentName) !== null}
                  />
                );
              })}
            </div>
          ) : null}

          <Card className="glass-panel mt-8 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Period</TableHead>
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
                    <TableCell className="font-medium">{r.period.periodLabel}</TableCell>
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
