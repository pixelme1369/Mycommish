import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";
import { latestCalculatedPeriods } from "@/lib/portal/queries";
import { listStatementsAwaitingManager } from "@/lib/statements";
import { StatementsAwaitingManager } from "@/components/statements-awaiting-manager";

export const dynamic = "force-dynamic";

export default async function ManagerHome() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const [windowPeriods, awaitingManager] = await Promise.all([
    latestCalculatedPeriods(),
    listStatementsAwaitingManager().catch(() => []),
  ]);
  const periodIds = windowPeriods.map((p) => p.id);

  const agentCounts =
    periodIds.length === 0
      ? []
      : await prisma.agentPeriod.groupBy({
          by: ["periodId"],
          where: { periodId: { in: periodIds } },
          _count: { _all: true },
        });
  const countByPeriod = new Map(agentCounts.map((c) => [c.periodId, c._count._all]));

  // Also list any other open calculated periods (beyond latest 2) for managers.
  const openExtras = await prisma.commissionPeriod.findMany({
    where: {
      source: PeriodSource.calculated,
      status: PeriodStatus.open,
      ...(periodIds.length ? { id: { notIn: periodIds } } : {}),
    },
    orderBy: { periodLabel: "desc" },
    take: 12,
  });

  const listed = [
    ...windowPeriods.map((p) => ({
      ...p,
      agentCount: countByPeriod.get(p.id) ?? 0,
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
            <span>· manager</span>
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
            <Link
              href="/manager/files"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              All files
            </Link>
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <div className="mt-8">
        <StatementsAwaitingManager rows={awaitingManager} viewBase="/manager" />
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-xl tracking-tight">Upcoming periods</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Same team view as admin — without delete, Gusto export, or dismiss.
        </p>

        {listed.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No calculated periods yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {listed.map((p) => (
              <li key={p.id}>
                <Card className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/manager/periods/${p.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {p.periodLabel}
                      </Link>
                      <Badge variant="secondary" className="capitalize">
                        {p.status}
                      </Badge>
                      {p.upcoming ? (
                        <Badge variant="outline">Latest window</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.filename || "CRM calculated"}
                      {p.agentCount != null ? ` · ${p.agentCount} agents` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/manager/periods/${p.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View team
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
