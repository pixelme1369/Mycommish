import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import {
  countFullySignedStatementsByPeriod,
  listFullySignedStatements,
} from "@/lib/statements";
import { RevokeStatementButton } from "./revoke-statement-button";
import { DocumentsSectionNav } from "@/app/admin/documents-section-nav";

export const dynamic = "force-dynamic";

export default async function AdminSignedStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const periodFilter = sp.period?.trim() || undefined;

  const [rows, periodCounts] = await Promise.all([
    listFullySignedStatements({
      periodLabel: periodFilter,
      limit: 500,
    }),
    countFullySignedStatementsByPeriod(),
  ]);

  const countByPeriod = new Map(periodCounts.map((p) => [p.periodLabel, p.count]));
  const totalSigned = periodCounts.reduce((sum, p) => sum + p.count, 0);

  const periodOptions = periodFilter
    ? [
        ...new Set([
          periodFilter,
          ...periodCounts.map((p) => p.periodLabel),
        ]),
      ].sort((a, b) => (a < b ? 1 : -1))
    : periodCounts.map((p) => p.periodLabel);

  const selectedCount = periodFilter
    ? (countByPeriod.get(periodFilter) ?? rows.length)
    : totalSigned;

  const bulkHref = periodFilter
    ? `/api/admin/statements/bulk?period=${encodeURIComponent(periodFilter)}`
    : "/api/admin/statements/bulk";

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            {adminHomeLinkLabel(session.user.role)}
          </Link>
        }
        title="Signed commissions"
        description="Fully signed commission PDFs (agent + manager). View, download, or revoke signatures."
        actions={
          <>
            {rows.length > 0 ? (
              <a
                href={bulkHref}
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                Bulk download ZIP
                {periodFilter ? ` · ${periodFilter}` : ""}
                {` · ${selectedCount}`}
              </a>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <DocumentsSectionNav active="statements" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/statements"
          className={cn(
            buttonVariants({ variant: periodFilter ? "outline" : "secondary", size: "sm" }),
            "h-8",
          )}
        >
          All periods{totalSigned > 0 ? ` (${totalSigned})` : ""}
        </Link>
        {periodOptions.map((p) => {
          const n = countByPeriod.get(p) ?? 0;
          return (
            <Link
              key={p}
              href={`/admin/statements?period=${encodeURIComponent(p)}`}
              className={cn(
                buttonVariants({
                  variant: periodFilter === p ? "secondary" : "outline",
                  size: "sm",
                }),
                "h-8",
              )}
            >
              {p} ({n})
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {periodFilter
          ? `${selectedCount} agent${selectedCount === 1 ? "" : "s"} fully signed for ${periodFilter}`
          : `${selectedCount} agent${selectedCount === 1 ? "" : "s"} fully signed across all periods`}
      </p>

      {rows.length === 0 ? (
        <Card className="glass-panel mt-4 p-6 text-sm text-muted-foreground">
          {periodFilter
            ? `No fully signed statements for ${periodFilter} yet.`
            : "No fully signed statements yet. They appear here after both agent and manager sign."}
        </Card>
      ) : (
        <Card className="glass-panel mt-4 overflow-hidden py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Net</th>
                <th className="px-4 py-2.5 font-medium">Agent signed</th>
                <th className="px-4 py-2.5 font-medium">Manager signed</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((r) => (
                <tr key={r.statementId}>
                  <td className="px-4 py-2.5 font-medium">{r.periodLabel}</td>
                  <td className="px-4 py-2.5">{r.agentName}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.netCommission)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.agentTypedName || "—"}
                    <span className="mx-1">·</span>
                    {r.agentSignedAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.managerTypedName || "—"}
                    <span className="mx-1">·</span>
                    {r.managerSignedAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.periodId && r.agentPeriodId ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <a
                          href={`/api/admin/periods/${r.periodId}/agents/${r.agentPeriodId}/statement?inline=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                        >
                          View
                        </a>
                        <a
                          href={`/api/admin/periods/${r.periodId}/agents/${r.agentPeriodId}/statement`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                        >
                          PDF
                        </a>
                        <Link
                          href={`/portal/period/${r.periodId}/agent/${r.agentPeriodId}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
                        >
                          Open
                        </Link>
                        <RevokeStatementButton
                          periodId={r.periodId}
                          agentPeriodId={r.agentPeriodId}
                          agentName={r.agentName}
                          periodLabel={r.periodLabel}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Re-upload CRM to restore
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
