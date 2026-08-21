import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { listFullySignedStatements } from "@/lib/statements";

export const dynamic = "force-dynamic";

export default async function AdminSignedStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const periodFilter = sp.period?.trim() || undefined;

  const rows = await listFullySignedStatements({
    periodLabel: periodFilter,
    limit: 200,
  });

  const periods = [...new Set(rows.map((r) => r.periodLabel))].sort((a, b) =>
    a < b ? 1 : -1,
  );
  // If filtered, still show that period in the filter chips even if somehow empty
  const periodOptions = periodFilter
    ? [...new Set([periodFilter, ...periods])]
    : periods;

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
            ← Admin
          </Link>
        }
        title="Signed statements"
        description="Fully signed commission PDFs (agent + manager). Download one or zip them all."
        actions={
          <>
            {rows.length > 0 ? (
              <a
                href={bulkHref}
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                Bulk download ZIP
                {periodFilter ? ` · ${periodFilter}` : ""}
              </a>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/statements"
          className={cn(
            buttonVariants({ variant: periodFilter ? "outline" : "secondary", size: "sm" }),
            "h-8",
          )}
        >
          All periods
        </Link>
        {periodOptions.map((p) => (
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
            {p}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="glass-panel mt-6 p-6 text-sm text-muted-foreground">
          {periodFilter
            ? `No fully signed statements for ${periodFilter} yet.`
            : "No fully signed statements yet. They appear here after both agent and manager sign."}
        </Card>
      ) : (
        <Card className="glass-panel mt-6 overflow-hidden py-0">
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
