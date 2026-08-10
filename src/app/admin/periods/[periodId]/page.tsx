import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { cancelRatePercent, money, ratePercent } from "@/lib/format";
import {
  getFixedRate,
  unitsToNextTier,
} from "@/lib/commission/calculator";
import { resolveEmployment } from "@/lib/agents/contractors";
import { DeletePeriodButton } from "@/app/admin/delete-period-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  await requireAdmin();
  const { periodId } = await params;

  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) notFound();

  const agents = await prisma.agentPeriod.findMany({
    where: { periodId },
    orderBy: [{ netCommission: "desc" }, { agentName: "asc" }],
  });

  const totals = agents.reduce(
    (acc, a) => {
      acc.units += a.unitsCleared;
      acc.gross += Number(a.grossCommission);
      acc.clawback += Number(a.clawbackAmount);
      acc.net += Number(a.netCommission);
      return acc;
    },
    { units: 0, gross: 0, clawback: 0, net: 0 },
  );

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
        title={period.periodLabel}
        description={
          <>
            Status: {period.status} · calculated
            {period.filename ? ` · ${period.filename}` : ""}
            {period.uploadedAt
              ? ` · uploaded ${period.uploadedAt.toISOString().slice(0, 10)}`
              : ""}
          </>
        }
        actions={
          <>
            <DeletePeriodButton periodId={period.id} periodLabel={period.periodLabel} />
            <SignOutButton />
          </>
        }
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agents" value={String(agents.length)} />
        <Stat label="Units cleared" value={String(totals.units)} />
        <Stat label="Gross" value={money(totals.gross)} />
        <Stat label="Net" value={money(totals.net)} accent />
      </div>

      {agents.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No agent rows for this period.</p>
      ) : (
        <Card className="glass-panel mt-8 overflow-hidden py-0">
          <table className="w-full table-fixed text-left text-[13px]">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Agent</th>
                <th className="px-2 py-2.5 text-right font-medium">Units</th>
                <th className="px-2 py-2.5 text-right font-medium">Next</th>
                <th className="px-2 py-2.5 text-right font-medium">Tier</th>
                <th className="px-2 py-2.5 text-right font-medium">Rate</th>
                <th className="px-2 py-2.5 text-right font-medium">Gross</th>
                <th className="px-2 py-2.5 text-right font-medium">Clawback</th>
                <th className="px-2 py-2.5 text-right font-medium">Net</th>
                <th className="px-2 py-2.5 text-right font-medium">Cancel</th>
                <th className="px-3 py-2.5 text-right font-medium">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {agents.map((r) => {
                const toNext = unitsToNextTier(r.unitsCleared, r.agentName);
                const fixed = getFixedRate(r.agentName) !== null;
                const hot = toNext != null && toNext <= 3;
                const warm = toNext != null && toNext <= 10;
                const employment = resolveEmployment(r.agentName);
                const isContractor = employment.employmentType === "contractor";
                const companyTitle = employment.companyName
                  ? `Contractor · ${employment.companyName}`
                  : "Contractor";

                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 align-middle">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium" title={r.agentName}>
                          {r.agentName}
                        </span>
                        {isContractor ? (
                          <span
                            className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                            title={companyTitle}
                          >
                            1099
                          </span>
                        ) : null}
                      </div>
                      {isContractor && employment.companyName ? (
                        <p
                          className="truncate text-[11px] leading-tight text-muted-foreground"
                          title={employment.companyName}
                        >
                          {employment.companyName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {r.unitsCleared}
                    </td>
                    <td className="px-2 py-2 text-right align-middle">
                      {toNext == null ? (
                        <span className="text-muted-foreground">
                          {fixed ? "Fixed" : r.adjustedTier >= 6 ? "Top" : "—"}
                        </span>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-1.5 py-0 text-[11px] tabular-nums",
                            hot && "bg-amber-100 text-amber-900",
                            warm && !hot && "bg-amber-50 text-amber-800",
                          )}
                        >
                          {toNext}
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {r.cancellationPenaltyApplied
                        ? `${r.rawTier}→${r.adjustedTier}`
                        : r.adjustedTier || "—"}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {ratePercent(r.tierRate)}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {money(r.grossCommission)}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {Number(r.clawbackAmount) > 0 ? (
                        <span className="text-destructive">-{money(r.clawbackAmount)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right align-middle font-semibold tabular-nums">
                      {money(r.netCommission)}
                    </td>
                    <td className="px-2 py-2 text-right align-middle tabular-nums">
                      {cancelRatePercent(r.cancellationRate)}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <a
                          href={`/api/admin/periods/${period.id}/agents/${r.id}/statement`}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          PDF
                        </a>
                        <span className="text-border">·</span>
                        <a
                          href={`/api/admin/periods/${period.id}/agents/${r.id}/export`}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          XLS
                        </a>
                        <span className="text-border">·</span>
                        <Link
                          href={`/portal/period/${period.id}/agent/${r.id}`}
                          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="glass-panel px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-lg ${accent ? "font-semibold text-[oklch(0.4_0.08_175)]" : "font-medium"}`}
      >
        {value}
      </p>
    </Card>
  );
}
