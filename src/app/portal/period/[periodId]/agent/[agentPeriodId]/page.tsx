import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  canActAsManager,
  canViewAllCommissions,
  isAdminUser,
  isSuperAdminUser,
  requireSession,
  sessionRole,
} from "@/lib/auth-guards";
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
  getWaitingFirstPaymentForAgent,
  getCancelRateBreakdownForAgent,
  mergeClawbacksWithCordoba,
  money,
  paidPeriodLabels,
  ratePercent,
  type MergedClawbackRow,
} from "@/lib/portal/queries";
import {
  commissionGainAtNextTier,
  getFixedRate,
  unitsToNextTier,
} from "@/lib/commission/calculator";
import { NextTierCard } from "@/components/next-tier-card";
import { ClawbackPaidRateEditor } from "./clawback-paid-rate-editor";
import { StatementSignPanel } from "./statement-sign-panel";
import { WaitingFirstPaymentSection } from "./waiting-first-payment-section";
import { CancelRateBreakdownSection } from "./cancel-rate-breakdown";
import { ManualBonusSection } from "./manual-bonus-section";
import { TeamLeadBonusMetric } from "./team-lead-bonus-metric";
import { PeriodPayStatusChip } from "@/components/period-pay-status-chip";
import { listManualBonusesForAgentPeriod } from "@/lib/manual-bonuses";
import { listAdvancesForAgentPeriod } from "@/lib/advances";
import { getStatementForAgentPeriodRow } from "@/lib/statements";
import { getTeamLeadBonusBreakdown } from "@/lib/teams/team-lead-bonus";
import { StatementSignStatus } from "@/generated/prisma/client";
import type { ClientEvent } from "@/generated/prisma/client";
type PortalClientEvent = ClientEvent & {
  identity?: { externalId: string | null } | null;
};

function externalIdOf(c: { crmId: string; externalId?: string | null; identity?: { externalId: string | null } | null }) {
  return c.externalId || c.identity?.externalId || c.crmId;
}

export const dynamic = "force-dynamic";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string; agentPeriodId: string }>;
}) {
  const session = await requireSession();
  const { periodId, agentPeriodId } = await params;
  const aliases = new Set(session.user.aliasNames || []);
  const staffView = canViewAllCommissions(session);
  const admin = isAdminUser(session);
  const role = sessionRole(session);
  const canManageManualBonus = canActAsManager(session);
  const superAdmin = isSuperAdminUser(session);

  let row = null;
  if (staffView) {
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
    // Staff deep-link after CRM re-upload: remap by periodLabel + agent name.
    if (!row) {
      const [period, stale] = await Promise.all([
        prisma.commissionPeriod.findFirst({
          where: { id: periodId, source: PeriodSource.calculated },
          select: { periodLabel: true },
        }),
        prisma.agentPeriod.findFirst({
          where: { id: agentPeriodId },
          select: { agentName: true },
        }),
      ]);
      if (period && stale) {
        row = await prisma.agentPeriod.findFirst({
          where: {
            agentName: stale.agentName,
            period: {
              source: PeriodSource.calculated,
              periodLabel: period.periodLabel,
            },
          },
          include: { period: true },
        });
      }
      if (!row && periodId) {
        // Last resort: agent period id still valid under a different period id.
        row = await prisma.agentPeriod.findFirst({
          where: {
            id: agentPeriodId,
            period: { source: PeriodSource.calculated },
          },
          include: { period: true },
        });
      }
    }
  } else {
    for (const name of aliases) {
      row = await getScopedAgentPeriod(periodId, agentPeriodId, name);
      if (row) break;
    }
    // Outside latest-2 / no remap — send home instead of a blank 404.
    if (!row) redirect("/portal");
  }
  if (!row) notFound();

  // Keep the URL in sync after a remap so refresh stays stable.
  if (row.id !== agentPeriodId || row.periodId !== periodId) {
    redirect(`/portal/period/${row.periodId}/agent/${row.id}`);
  }

  const { cleared, clawbacks, pending, cancelled, all } = await getClientsForAgentPeriod(
    row.id,
  );
  const waitingFirstPayment = await getWaitingFirstPaymentForAgent(
    [row.agentName],
    row.period.periodLabel,
  );
  const cancelRateBreakdown = await getCancelRateBreakdownForAgent(
    [row.agentName],
    row.period.periodLabel,
  );
  const { paidIds, chargebackSeenIds } = await getCordobaFlags(all.map((e) => e.crmId));
  const mergedClawbacks = await mergeClawbacksWithCordoba(
    row.agentName,
    row.period.periodLabel,
    clawbacks,
  );
  const showAdminCordobaClawback = staffView;
  const isAgentView = !staffView;
  const notesForDisplay = row.notes
    ? isAgentView
      ? row.notes
          .replace(/\(contract override,\s*tier table not applied\)/gi, "")
          .replace(/contract override/gi, "")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+\|/g, " |")
          .replace(/\|\s+\|/g, "|")
          .trim()
      : row.notes
    : null;

  const backHref =
    admin
      ? `/admin/periods/${periodId}`
      : role === "manager"
        ? `/manager/periods/${periodId}`
        : "/portal";
  const backLabel =
    staffView ? `← ${row.period.periodLabel} agents` : "← My commissions";

  const statement = await getStatementForAgentPeriodRow(row);
  const manualBonusesRaw = await listManualBonusesForAgentPeriod({
    agentPeriodId: row.id,
    periodLabel: row.period.periodLabel,
    agentName: row.agentName,
  });
  // Agents: amount/status only — manager notes are for staff / super-admin review.
  const manualBonuses = isAgentView
    ? manualBonusesRaw.map((b) => ({
        ...b,
        note: "",
        createdByName: "",
        approvedByName: null,
      }))
    : manualBonusesRaw;
  const advances = await listAdvancesForAgentPeriod({
    agentName: row.agentName,
    periodLabel: row.period.periodLabel,
  });
  const teamLeadBonusBreakdown =
    Number(row.teamLeadBonusAmount) > 0
      ? await getTeamLeadBonusBreakdown(row.id)
      : null;
  const periodIsPaid = (
    await paidPeriodLabels([row.period.periodLabel])
  ).has(row.period.periodLabel);
  const pendingPayout =
    !periodIsPaid && statement?.status === StatementSignStatus.fully_signed;
  const pendingManualBonusTotal = manualBonuses
    .filter((b) => b.status === "pending")
    .reduce((s, b) => s + b.amount, 0);
  const ownsAsAgent = aliases.has(row.agentName);
  const signRole =
    ownsAsAgent && !statement?.agentSignedAt
      ? "agent"
      : staffView && statement?.status === "agent_signed"
        ? "manager"
        : ownsAsAgent
          ? "agent"
          : staffView
            ? "manager"
            : "agent";
  const canReset =
    staffView ||
    (ownsAsAgent && statement?.status === "agent_signed");

  return (
    <AppShell wide className={isAgentView ? "py-8 sm:py-9" : undefined}>
      <PageHeader
        compact={isAgentView}
        eyebrow={
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            {backLabel}
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {row.agentName} · {row.period.periodLabel}
            </span>
            <PeriodPayStatusChip paid={periodIsPaid} pendingPayout={pendingPayout} />
          </span>
        }
        description={`Status: ${row.period.status} · source: calculated`}
        actions={
          <>
            {admin ? (
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
            ) : role === "manager" ? (
              <Link
                href="/manager/files"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Claim a file
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <NextTierCard
          className="sm:w-44 sm:shrink-0"
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
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-border/70">
          <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-3 lg:grid-cols-4">
            <Metric label="Units" value={String(row.unitsCleared)} />
            <Metric
              label="Tier / rate"
              value={
                row.cancellationPenaltyApplied
                  ? `${row.rawTier}→${row.adjustedTier} · ${ratePercent(row.tierRate)}`
                  : `${row.adjustedTier || "—"} · ${ratePercent(row.tierRate)}`
              }
            />
            <Metric label="Gross" value={money(row.grossCommission)} />
            <Metric label="Net" value={money(row.netCommission)} accent />
            <Metric
              label="Clawback"
              value={Number(row.clawbackAmount) > 0 ? `-${money(row.clawbackAmount)}` : "—"}
              danger={Number(row.clawbackAmount) > 0}
            />
            {Number(row.advancePaidAmount) > 0 ? (
              <Metric
                label="Advance paid"
                value={`+${money(row.advancePaidAmount)}`}
              />
            ) : null}
            {Number(row.advanceRepayAmount) > 0 ? (
              <Metric
                label="Advance repay"
                value={`-${money(row.advanceRepayAmount)}`}
                danger
              />
            ) : null}
            {Number(row.teamLeadBonusAmount) > 0 ? (
              teamLeadBonusBreakdown ? (
                <TeamLeadBonusMetric breakdown={teamLeadBonusBreakdown} />
              ) : (
                <Metric
                  label="Team lead bonus"
                  value={`+${money(row.teamLeadBonusAmount)}`}
                />
              )
            ) : null}
            <Metric label="Cancel rate" value={cancelRatePercent(row.cancellationRate)} />
            <Metric label="Pending cancellations" value={String(row.pendingUnits)} />
            <Metric label="Cleared debt" value={money(row.totalClearedDebt)} />
          </div>
        </div>
      </div>

      {isAgentView && pendingManualBonusTotal > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Manual bonus pending super-admin approval:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {money(pendingManualBonusTotal)}
          </span>
          {" "}(not included in net yet).
        </p>
      ) : null}

      {notesForDisplay ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{notesForDisplay}</p>
      ) : null}

      <StatementSignPanel
        className="mt-6"
        periodId={periodId}
        agentPeriodId={row.id}
        periodLabel={row.period.periodLabel}
        role={signRole}
        lockedName={session.user.displayName || ""}
        status={statement?.status ?? "unsigned"}
        agentSignedAt={statement?.agentSignedAt?.toISOString() ?? null}
        agentTypedName={statement?.agentTypedName ?? null}
        managerSignedAt={statement?.managerSignedAt?.toISOString() ?? null}
        managerTypedName={statement?.managerTypedName ?? null}
        canReset={canReset}
      />

      <ManualBonusSection
        periodId={periodId}
        agentPeriodId={row.id}
        bonuses={manualBonuses}
        canManage={canManageManualBonus}
        canApprove={superAdmin}
        agentView={isAgentView}
      />

      {advances.length > 0 ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-heading text-base tracking-tight">Advances</h2>
            {staffView ? (
              <Link
                href="/manager/advances"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Manage
              </Link>
            ) : null}
          </div>
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {advances.map((a) => {
                const onPay = a.payWithPeriodLabel === row.period.periodLabel;
                return (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="font-medium tabular-nums">
                      {onPay ? "+" : "−"}
                      {money(a.amount)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {onPay
                          ? `included on this paycheck · recovers from ${a.deductFromPeriodLabel}`
                          : `repaying advance from ${a.payWithPeriodLabel}`}
                      </span>
                    </p>
                    {a.note ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.note}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      <ClearedSection
        clients={cleared}
        paidIds={paidIds}
        chargebackSeenIds={chargebackSeenIds}
        showCordobaClawback={showAdminCordobaClawback}
      />
      <WaitingFirstPaymentSection rows={waitingFirstPayment} />
      <ClawbackSection
        rows={mergedClawbacks}
        canEditPaidRate={superAdmin}
        periodId={row.periodId}
        agentPeriodId={row.id}
      />
      <ClientSection title="Pending cancellations" clients={pending} />
      <ClientSection title="Cancelled (not clawed)" clients={cancelled} />
      <CancelRateBreakdownSection
        breakdown={cancelRateBreakdown}
        storedRatePct={Number(row.cancellationRate)}
      />
    </AppShell>
  );
}

function Metric({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-background px-3 py-2.5",
        accent && "bg-primary/10",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-medium tracking-wider uppercase",
          accent ? "text-money" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums text-foreground",
          accent && "text-money",
          danger && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
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
      className={tone === "green" ? "bg-money text-money-foreground" : undefined}
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
  clients: PortalClientEvent[];
  paidIds: Set<string>;
  chargebackSeenIds: Set<string>;
  showCordobaClawback: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-base tracking-tight">
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
                <th className="px-3 py-2 font-medium">AMOD</th>
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
                  <td className="px-3 py-2 font-mono text-xs">{externalIdOf(c)}</td>
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

function ClawbackSection({
  rows,
  canEditPaidRate,
  periodId,
  agentPeriodId,
}: {
  rows: MergedClawbackRow[];
  canEditPaidRate: boolean;
  periodId: string;
  agentPeriodId: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-heading text-base tracking-tight">
        Clawbacks{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cordoba Charge back is Yes when Cordoba also lists the client. A $0.00 row with Yes means
        flagged but not deducted yet.
        {canEditPaidRate
          ? " Super admin: set Paid rate % when history Rate is missing (e.g. 2025 clears) — clawback becomes debt × rate."
          : null}
      </p>
      <Card className="glass-panel mt-3 overflow-x-auto py-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">AMOD</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Enrolled debt</th>
              <th className="px-3 py-2 font-medium">Cleared</th>
              <th className="px-3 py-2 font-medium">Dropped</th>
              <th className="px-3 py-2 font-medium">Clawback</th>
              {canEditPaidRate ? (
                <th className="px-3 py-2 font-medium">Paid rate</th>
              ) : null}
              <th className="px-3 py-2 font-medium">Cordoba Charge back</th>
              <th className="px-3 py-2 font-medium">Kind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((c) => (
              <tr key={c.id} className={c.cordobaOnly ? "bg-muted/30" : undefined}>
                <td className="px-3 py-2 font-mono text-xs">{externalIdOf(c)}</td>
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
                {canEditPaidRate ? (
                  <td className="px-3 py-2 align-top">
                    <ClawbackPaidRateEditor
                      clientEventId={c.cordobaOnly ? "" : c.id}
                      crmId={c.crmId}
                      cordobaOnly={c.cordobaOnly}
                      paidRate={c.paidRate}
                      periodId={periodId}
                      agentPeriodId={agentPeriodId}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <YesNo yes={c.cordobaChargeBack} tone="red" />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function ClientSection({
  title,
  clients,
}: {
  title: string;
  clients: PortalClientEvent[];
}) {
  if (clients.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-heading text-base tracking-tight">
        {title}{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({clients.length})
        </span>
      </h2>
      <Card className="glass-panel mt-3 overflow-x-auto py-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">AMOD</th>
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
                <td className="px-3 py-2 font-mono text-xs">{externalIdOf(c)}</td>
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
    </section>
  );
}
