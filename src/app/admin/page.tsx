import Link from "next/link";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin, isSuperAdminUser } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminCalculatedPeriods } from "./admin-calculated-periods";
import { AdminImportSection } from "./admin-import-section";
import { AdminSecondarySections } from "./admin-secondary-sections";
import { StatementsAwaitingManager } from "@/components/statements-awaiting-manager";
import {
  listFullySignedStatements,
  listStatementsAwaitingManager,
} from "@/lib/statements";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";
import { money } from "@/lib/format";
import {
  countPendingManualBonuses,
  listPendingManualBonuses,
} from "@/lib/manual-bonuses";
import { ApproveManualBonusButton } from "@/components/approve-manual-bonus-button";

export const dynamic = "force-dynamic";

type PeriodRow = Awaited<ReturnType<typeof listCalculatedPeriods>>[number];

/** Newest month first; open periods before closed. */
function sortPeriodsForDashboard(periods: PeriodRow[]) {
  return [...periods].sort((a, b) => {
    const openFirst = (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1);
    if (openFirst !== 0) return openFirst;
    if (a.periodLabel !== b.periodLabel) {
      return a.periodLabel < b.periodLabel ? 1 : -1;
    }
    const aTime = a.uploadedAt?.getTime() ?? 0;
    const bTime = b.uploadedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

function groupByFilename(periods: PeriodRow[]) {
  const map = new Map<string, PeriodRow[]>();
  for (const p of periods) {
    const key = p.filename?.trim() || "(no filename)";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([filename, group]) => [filename, sortPeriodsForDashboard(group)] as const)
    .sort((a, b) => {
      const aTop = a[1][0]?.periodLabel ?? "";
      const bTop = b[1][0]?.periodLabel ?? "";
      if (aTop === bTop) return 0;
      return aTop < bTop ? 1 : -1;
    });
}

function toDashboardRow(p: PeriodRow) {
  return {
    id: p.id,
    periodLabel: p.periodLabel,
    status: p.status,
    agentCount: p._count.agentPeriods,
    filename: p.filename,
  };
}

function formatUploadDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastOfType(
  uploads: Awaited<ReturnType<typeof listRecentUploads>>,
  type: string,
) {
  return uploads.find((u) => u.type === type) ?? null;
}

export default async function AdminHome() {
  const session = await requireAdmin();
  const superAdmin = isSuperAdminUser(session);
  const [
    periodsRaw,
    historyPeriodsRaw,
    uploads,
    pendingClaims,
    awaitingManager,
    fullySigned,
    fullySignedCount,
    pendingManualBonuses,
    pendingManualBonusCount,
  ] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
    prisma.fileClaim
      .count({ where: { status: FileClaimStatus.pending } })
      .catch(() => 0),
    listStatementsAwaitingManager().catch(() => []),
    listFullySignedStatements({ limit: 8 }).catch(() => []),
    prisma.commissionStatement
      .count({ where: { status: "fully_signed" } })
      .catch(() => 0),
    superAdmin ? listPendingManualBonuses().catch(() => []) : Promise.resolve([]),
    superAdmin ? countPendingManualBonuses().catch(() => 0) : Promise.resolve(0),
  ]);

  const periods = sortPeriodsForDashboard(periodsRaw);
  const openPeriods = periods.filter((p) => p.status === "open").map(toDashboardRow);
  const closedPeriods = periods
    .filter((p) => p.status !== "open")
    .map(toDashboardRow);

  const historyPeriods = [...historyPeriodsRaw].sort((a, b) =>
    a.periodLabel < b.periodLabel ? 1 : a.periodLabel > b.periodLabel ? -1 : 0,
  );
  const historyGroups = groupByFilename(historyPeriods).map(([filename, group]) => ({
    filename,
    periods: group.map((p) => ({
      id: p.id,
      periodLabel: p.periodLabel,
      agentCount: p._count.agentPeriods,
    })),
  }));

  const lastCrm = lastOfType(uploads, "crm");
  const lastCordoba = lastOfType(uploads, "cordoba");
  const lastHistory = lastOfType(uploads, "history");
  const newestOpen = openPeriods[0]?.periodLabel ?? null;

  const statusParts = [
    `${openPeriods.length} open`,
    `${closedPeriods.length} closed`,
    newestOpen ? `current ${newestOpen}` : null,
    pendingClaims > 0 ? `${pendingClaims} file claim${pendingClaims === 1 ? "" : "s"}` : null,
    awaitingManager.length > 0
      ? `${awaitingManager.length} statement${awaitingManager.length === 1 ? "" : "s"} awaiting manager`
      : null,
    fullySignedCount > 0
      ? `${fullySignedCount} signed PDF${fullySignedCount === 1 ? "" : "s"}`
      : null,
    pendingManualBonusCount > 0
      ? `${pendingManualBonusCount} manual bonus${pendingManualBonusCount === 1 ? "" : "es"} pending`
      : null,
    lastCrm ? `CRM ${formatUploadDay(lastCrm.createdAt)}` : null,
    lastCordoba ? `Cordoba ${formatUploadDay(lastCordoba.createdAt)}` : null,
    lastHistory ? `History ${formatUploadDay(lastHistory.createdAt)}` : null,
  ].filter(Boolean);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {session.user.displayName}</span>
          </span>
        }
        title={adminNavLabel(session.user.role)}
        description="Open a period to pay · import only when files are ready"
        actions={
          <>
            <Link
              href="/admin/claims"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              File claims
            </Link>
            <Link
              href="/admin/statements"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Signed PDFs
            </Link>
            <Link
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Users
            </Link>
            {superAdmin ? (
              <Link
                href="/superadmin/manual-bonuses"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Manual bonuses
                {pendingManualBonusCount > 0 ? ` (${pendingManualBonusCount})` : ""}
              </Link>
            ) : (
              <Link
                href="/portal"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Portal
              </Link>
            )}
            <Link
              href="/manager"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manager view
            </Link>
            <SignOutButton />
          </>
        }
      />

      <Card className="glass-panel mt-8 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Status</span>
          <span className="mx-2 text-border">·</span>
          {statusParts.join(" · ")}
        </p>
      </Card>

      {superAdmin ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl tracking-tight">Manual bonuses</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Waiting for your approval — approved amounts add to the agent’s net commission.
              </p>
            </div>
            <Link
              href="/superadmin/manual-bonuses"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View all →
            </Link>
          </div>

          {pendingManualBonuses.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">None waiting right now.</p>
          ) : (
            <Card className="glass-panel mt-4 overflow-hidden py-0">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Agent</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Note</th>
                    <th className="px-4 py-2.5 font-medium">Logged by</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {pendingManualBonuses.slice(0, 8).map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2.5 font-medium">{b.periodLabel}</td>
                      <td className="px-4 py-2.5">{b.agentName}</td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold text-money">
                        {money(b.amount)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">
                        {b.note}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {b.createdByName}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ApproveManualBonusButton
                          bonusId={b.id}
                          agentName={b.agentName}
                          periodLabel={b.periodLabel}
                          amount={b.amount}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      ) : null}

      <div className="mt-8">
        <StatementsAwaitingManager rows={awaitingManager} viewBase="/admin" />
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl tracking-tight">Signed statements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fully signed by agent and manager — archive and bulk download.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {fullySigned.length > 0 ? (
              <a
                href="/api/admin/statements/bulk"
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                Bulk download ZIP
              </a>
            ) : null}
            <Link
              href="/admin/statements"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View all →
            </Link>
          </div>
        </div>

        {fullySigned.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No fully signed statements yet.
          </p>
        ) : (
          <Card className="glass-panel mt-4 overflow-hidden py-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium">Agent</th>
                  <th className="px-4 py-2.5 font-medium">Net</th>
                  <th className="px-4 py-2.5 font-medium">Manager signed</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {fullySigned.map((r) => (
                  <tr key={r.statementId}>
                    <td className="px-4 py-2.5 font-medium">{r.periodLabel}</td>
                    <td className="px-4 py-2.5">{r.agentName}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(r.netCommission)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.managerSignedAt.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.periodId && r.agentPeriodId ? (
                        <a
                          href={`/api/admin/periods/${r.periodId}/agents/${r.agentPeriodId}/statement`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Detached</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <div className="mt-8">
        <AdminCalculatedPeriods
          openPeriods={openPeriods}
          closedPeriods={closedPeriods}
        />
      </div>

      <div className="mt-12">
        <AdminImportSection />
      </div>

      <div className="mt-12">
        <AdminSecondarySections
          historyGroups={historyGroups}
          historyCount={historyPeriods.length}
          uploads={uploads.slice(0, 8).map((u) => ({
            id: u.id,
            type: u.type,
            filename: u.filename,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </AppShell>
  );
}
