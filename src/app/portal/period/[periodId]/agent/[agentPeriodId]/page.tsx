import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cancelRatePercent,
  getClientsForAgentPeriod,
  getCordobaFlags,
  getScopedAgentPeriod,
  mergeClawbacksWithCordoba,
  money,
  ratePercent,
  type MergedClawbackRow,
} from "@/lib/portal/queries";
import {
  commissionGainAtNextTier,
  getFixedRate,
  unitsToNextTier,
} from "@/lib/commission/calculator";
import { NextTierCard } from "@/components/next-tier-card";
import type { ClientEvent } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string; agentPeriodId: string }>;
}) {
  const session = await requireSession();
  const { periodId, agentPeriodId } = await params;
  const aliases = new Set(session.user.aliasNames || []);

  let row = null;
  if (session.user.isAdmin) {
    const { prisma } = await import("@/lib/db");
    const { PeriodSource } = await import("@/generated/prisma/client");
    row = await prisma.agentPeriod.findFirst({
      where: {
        id: agentPeriodId,
        periodId,
        period: { source: PeriodSource.calculated },
      },
      include: { period: true },
    });
  } else {
    for (const name of aliases) {
      row = await getScopedAgentPeriod(periodId, agentPeriodId, name);
      if (row) break;
    }
  }
  if (!row) notFound();

  const { cleared, clawbacks, pending, cancelled, all } = await getClientsForAgentPeriod(
    row.id,
  );
  const { paidIds, chargebackSeenIds } = await getCordobaFlags(all.map((e) => e.crmId));
  const mergedClawbacks = await mergeClawbacksWithCordoba(
    row.agentName,
    row.period.periodLabel,
    clawbacks,
  );
  const showAdminCordobaClawback = session.user.isAdmin;

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          session.user.isAdmin ? (
            <Link
              href={`/admin/periods/${periodId}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
            >
              ← {row.period.periodLabel} agents
            </Link>
          ) : (
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
            >
              ← My commissions
            </Link>
          )
        }
        title={`${row.agentName} · ${row.period.periodLabel}`}
        description={`Status: ${row.period.status} · source: calculated`}
        actions={
          <>
            {session.user.isAdmin ? (
              <>
                <a
                  href={`/api/admin/periods/${periodId}/agents/${agentPeriodId}/statement`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                >
                  Statement PDF
                </a>
                <a
                  href={`/api/admin/periods/${periodId}/agents/${agentPeriodId}/export`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Excel
                </a>
              </>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Units" value={String(row.unitsCleared)} />
        <Stat
          label="Tier / rate"
          value={
            row.cancellationPenaltyApplied
              ? `${row.rawTier}→${row.adjustedTier} · ${ratePercent(row.tierRate)}`
              : `${row.adjustedTier || "—"} · ${ratePercent(row.tierRate)}`
          }
        />
        <Stat label="Gross" value={money(row.grossCommission)} />
        <Stat label="Net" value={money(row.netCommission)} accent />
        <Stat
          label="Clawback"
          value={Number(row.clawbackAmount) > 0 ? `-${money(row.clawbackAmount)}` : "—"}
        />
        <Stat label="Cancel rate" value={cancelRatePercent(row.cancellationRate)} />
        <Stat label="Pending cancellations" value={String(row.pendingUnits)} />
        <Stat label="Cleared debt" value={money(row.totalClearedDebt)} />
        <NextTierCard
          unitsNeeded={unitsToNextTier(row.unitsCleared, row.agentName)}
          gain={commissionGainAtNextTier(
            row.adjustedTier,
            Number(row.totalClearedDebt),
            Number(row.grossCommission),
            row.agentName,
          )}
          atTopTier={row.adjustedTier >= 6}
          fixedRate={getFixedRate(row.agentName) !== null}
        />
      </div>

      {row.notes ? (
        <Card className="glass-panel mt-6 px-4 py-3 text-sm text-muted-foreground">
          {row.notes}
        </Card>
      ) : null}

      <ClearedSection
        clients={cleared}
        paidIds={paidIds}
        chargebackSeenIds={chargebackSeenIds}
        showCordobaClawback={showAdminCordobaClawback}
      />
      <ClawbackSection rows={mergedClawbacks} />
      <ClientSection
        title="Pending cancellations"
        clients={pending}
        empty="No pending cancellations."
      />
      <ClientSection
        title="Cancelled (not clawed)"
        clients={cancelled}
        empty="No same-month / safe cancels."
      />
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

function YesNo({ yes, tone }: { yes: boolean; tone: "green" | "red" | "amber" }) {
  if (!yes) {
    return <span className="text-muted-foreground">No</span>;
  }
  const variant =
    tone === "green" ? "default" : tone === "red" ? "destructive" : "secondary";
  return (
    <Badge
      variant={variant}
      className={tone === "green" ? "bg-[oklch(0.45_0.08_175)]" : undefined}
    >
      Yes
    </Badge>
  );
}

function ClearedSection({
  clients,
  paidIds,
  chargebackSeenIds,
  showCordobaClawback,
}: {
  clients: ClientEvent[];
  paidIds: Set<string>;
  chargebackSeenIds: Set<string>;
  showCordobaClawback: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl tracking-tight">
        Cleared clients{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({clients.length})
        </span>
      </h2>
      {clients.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No cleared clients.</p>
      ) : (
        <Card className="glass-panel mt-3 overflow-x-auto py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Cordoba Payout</th>
                {showCordobaClawback ? (
                  <th className="px-3 py-2 font-medium">Cordoba Clawback</th>
                ) : null}
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{money(c.commissionOnClient)}</td>
                  <td className="px-3 py-2">
                    <YesNo
                      yes={paidIds.has(c.crmId)}
                      tone={paidIds.has(c.crmId) ? "green" : "amber"}
                    />
                  </td>
                  {showCordobaClawback ? (
                    <td className="px-3 py-2">
                      <YesNo
                        yes={chargebackSeenIds.has(c.crmId)}
                        tone={chargebackSeenIds.has(c.crmId) ? "red" : "amber"}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function ClawbackSection({ rows }: { rows: MergedClawbackRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl tracking-tight">
        Clawbacks{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cordoba Charge back is Yes when Cordoba&apos;s Chargebacks tab also lists the client. A
        $0.00 row with Yes means flagged but not deducted yet (usually no Dropped Date on file).
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No clawbacks.</p>
      ) : (
        <Card className="glass-panel mt-3 overflow-x-auto py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Clawback</th>
                <th className="px-3 py-2 font-medium">Cordoba Charge back</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((c) => (
                <tr key={c.id} className={c.cordobaOnly ? "bg-muted/30" : undefined}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2">
                    <span className="text-destructive">-{money(c.clawbackAmount)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <YesNo yes={c.cordobaChargeBack} tone="red" />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function ClientSection({
  title,
  clients,
  empty,
}: {
  title: string;
  clients: ClientEvent[];
  empty: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl tracking-tight">
        {title}{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({clients.length})
        </span>
      </h2>
      {clients.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Card className="glass-panel mt-3 overflow-x-auto py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Enrolled debt</th>
                <th className="px-3 py-2 font-medium">Cleared</th>
                <th className="px-3 py-2 font-medium">Dropped</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono text-xs">{c.crmId}</td>
                  <td className="px-3 py-2">
                    {c.clientName || "—"}
                    {c.isLowCredit ? (
                      <span className="ml-2 text-xs text-amber-700">$0 credit</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(c.enrolledDebt)}</td>
                  <td className="px-3 py-2">{c.firstPaymentClearedDate || "—"}</td>
                  <td className="px-3 py-2">{c.droppedDate || "—"}</td>
                  <td className="px-3 py-2">{money(c.commissionOnClient)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
