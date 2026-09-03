import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { PeriodSource, PeriodStatus, FileClaimStatus } from "@/generated/prisma/client";
import { latestCalculatedPeriods } from "@/lib/portal/queries";
import { listStatementsAwaitingManager } from "@/lib/statements";
import { listOpenerStatementsAwaitingManager } from "@/lib/opener/statements";
import { StatementsAwaitingManager, OpenerStatementsAwaitingManager } from "@/components/statements-awaiting-manager";
import { sumMyOwedBonuses } from "@/lib/manager-bonuses";
import { money } from "@/lib/format";
import { countActiveAgentsByPeriod } from "@/lib/agents/active-period-counts";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";

export const dynamic = "force-dynamic";

export default async function ManagerHome() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const agentId = session.user.agentId;
  const [windowPeriods, awaitingManager, awaitingOpenerManager, owedTotal, pendingClaims] = await Promise.all([
    latestCalculatedPeriods(),
    listStatementsAwaitingManager().catch(() => []),
    listOpenerStatementsAwaitingManager().catch(() => []),
    agentId ? sumMyOwedBonuses(agentId) : Promise.resolve(0),
    prisma.fileClaim
      .count({ where: { status: FileClaimStatus.pending } })
      .catch(() => 0),
  ]);
  const periodIds = windowPeriods.map((p) => p.id);

  const [activeCounts, openExtras] = await Promise.all([
    countActiveAgentsByPeriod(
      windowPeriods.map((p) => ({ id: p.id, periodLabel: p.periodLabel })),
    ),
    prisma.commissionPeriod.findMany({
      where: {
        source: PeriodSource.calculated,
        status: PeriodStatus.open,
        ...(periodIds.length ? { id: { notIn: periodIds } } : {}),
      },
      orderBy: { periodLabel: "desc" },
      take: 12,
    }),
  ]);

  const listed = [
    ...windowPeriods.map((p) => ({
      ...p,
      agentCount: activeCounts.get(p.id) ?? 0,
      upcoming: true as const,
    })),
    ...openExtras.map((p) => ({ ...p, agentCount: null as number | null, upcoming: false as const })),
  ];

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="Team commissions"
        description={
          <>
            {session.user.displayName}
            {" · "}
            view-only for upcoming calculated periods · claim files when something looks wrong
          </>
        }
        actions={
          <>
            <ManagerTopNav
              active="commissions"
              pendingClaims={pendingClaims}
              showAgentPortal={Boolean(agentId)}
            />
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
          </>
        }
      />

      {owedTotal > 0 ? (
        <Card className="glass-panel mt-8 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Owed to you</span>
            <span className="mx-2 text-border">·</span>
            <span className="font-semibold text-money tabular-nums">{money(owedTotal)}</span>
            <span className="text-muted-foreground">
              {" "}
              unpaid ·{" "}
              <Link href="/manager/bonuses" className="underline-offset-2 hover:underline">
                view bonus payouts
              </Link>
            </span>
          </p>
        </Card>
      ) : null}

      <div className="mt-8">
        <StatementsAwaitingManager rows={awaitingManager} viewBase="/manager" />
        <OpenerStatementsAwaitingManager rows={awaitingOpenerManager} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-xl tracking-tight">Upcoming periods</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest calculated months · open a period to review the team
            </p>
          </div>
        </div>

        {listed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calculated periods yet.</p>
        ) : (
          <Card className="glass-panel overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {listed.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/manager/periods/${p.id}`}
                      className="font-medium tabular-nums hover:underline"
                    >
                      {p.periodLabel}
                    </Link>
                    <Badge
                      variant={p.status === "open" ? "secondary" : "outline"}
                      className="font-normal capitalize"
                    >
                      {p.status}
                    </Badge>
                    {p.upcoming ? (
                      <Badge variant="outline" className="font-normal">
                        Latest
                      </Badge>
                    ) : null}
                    {p.agentCount != null ? (
                      <span className="text-muted-foreground tabular-nums">
                        {p.agentCount} agents
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/manager/periods/${p.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "shrink-0 text-muted-foreground",
                    )}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
