import Link from "next/link";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminCalculatedPeriods } from "./admin-calculated-periods";
import { AdminImportSection } from "./admin-import-section";
import { AdminSecondarySections } from "./admin-secondary-sections";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";

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
  const [periodsRaw, historyPeriodsRaw, uploads, pendingClaims] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
    prisma.fileClaim
      .count({ where: { status: FileClaimStatus.pending } })
      .catch(() => 0),
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
        title="Admin"
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
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Users
            </Link>
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Portal
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
