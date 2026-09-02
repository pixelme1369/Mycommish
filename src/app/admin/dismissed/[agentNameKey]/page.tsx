import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money, ratePercent } from "@/lib/format";
import { prisma } from "@/lib/db";
import { dismissalKey } from "@/lib/agents/dismissal";
import {
  loadLastCheck,
  loadLastPays,
  resolveLastCheckAgentPeriodId,
} from "@/lib/agents/last-check-load";
import { LastCheckDetails } from "@/app/admin/last-check/last-check-details";
import { LastCheckExportButtons } from "@/app/admin/last-check/[agentPeriodId]/last-check-export";
import { ReinstateSalesRepButton } from "@/app/admin/dismiss-buttons";

export const dynamic = "force-dynamic";

export default async function DismissedRepPage({
  params,
}: {
  params: Promise<{ agentNameKey: string }>;
}) {
  await requireAdmin();
  const { agentNameKey: rawKey } = await params;
  const agentNameKey = dismissalKey(decodeURIComponent(rawKey));
  const dismissal = await prisma.salesRepDismissal.findUnique({
    where: { agentNameKey },
  });
  if (!dismissal) notFound();

  const lastCheckId = await resolveLastCheckAgentPeriodId(dismissal.agentName);
  const [lastPays, lastCheck] = await Promise.all([
    loadLastPays(dismissal.agentName),
    lastCheckId ? loadLastCheck(lastCheckId) : Promise.resolve(null),
  ]);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· Dismissed</span>
          </span>
        }
        title={dismissal.agentName}
        description={`Dismissed ${dismissal.dismissedAt.toISOString().slice(0, 10)}${dismissal.note ? ` · ${dismissal.note}` : ""} · last check is threshold files only, not remaining commission`}
        actions={
          <>
            <Link
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Back to Users
            </Link>
            <LastCheckExportButtons
              agentPeriodId={lastCheck?.agentPeriodId ?? null}
              canGusto={(lastCheck?.gustoAmount ?? 0) > 0}
              lastPaysKey={agentNameKey}
              canLastPays={lastPays.length > 0}
            />
            <ReinstateSalesRepButton agentName={dismissal.agentName} />
            <SignOutButton />
          </>
        }
      />

      <section className="mt-8">
        <h2 className="font-heading text-base tracking-tight">Last check</h2>
        {lastCheck ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay only files from {lastCheck.periodLabel} that already passed the payment
              threshold. Remaining commissioned files that have not hit threshold are not
              paid. {lastCheck.tierLabel}
              {lastCheck.units > 0 && lastCheck.tierRate > 0
                ? ` at ${ratePercent(lastCheck.tierRate)}`
                : ""}
              .
            </p>
            <LastCheckDetails view={lastCheck} />
          </>
        ) : (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            No threshold files or clawbacks on upcoming periods. Nothing extra to pay
            on dismiss.
          </Card>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-base tracking-tight">
          Already paid{" "}
          <Badge variant="secondary" className="ml-1 font-normal">
            {lastPays.length}
          </Badge>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          History only — paychecks already logged. Not remaining commission and not
          added to the last check.
        </p>
        {lastPays.length === 0 ? (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            No prior pays on file.
          </Card>
        ) : (
          <Card className="glass-panel mt-3 overflow-x-auto py-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Units</th>
                  <th className="px-3 py-2 text-right font-medium">Gross</th>
                  <th className="px-3 py-2 text-right font-medium">Clawbacks</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {lastPays.map((row) => (
                  <tr key={row.agentPeriodId}>
                    <td className="px-3 py-2 tabular-nums">{row.periodLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.source === "history" ? "Logged as paid" : "Calculated"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.unitsCleared}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.grossCommission)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      {row.clawbackAmount > 0 ? `−${money(row.clawbackAmount)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.netCommission)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={row.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
