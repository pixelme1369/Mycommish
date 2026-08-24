import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import {
  listManualBonusesForAdmin,
  type ManualBonusView,
} from "@/lib/manual-bonuses";
import { ApproveManualBonusButton } from "@/components/approve-manual-bonus-button";

export const dynamic = "force-dynamic";

export default async function SuperAdminManualBonusesPage() {
  const session = await requireSuperAdmin();
  const { pending, approved } = await listManualBonusesForAdmin();

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
        title="Manual bonuses"
        description="Approve manager-submitted bonuses, then review what’s already been added to net."
        actions={<SignOutButton />}
      />

      <section className="mt-8">
        <h2 className="font-heading text-base tracking-tight">Waiting for approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved amounts add to the agent’s net commission.
        </p>
        {pending.length === 0 ? (
          <Card className="glass-panel mt-4 p-6 text-sm text-muted-foreground">
            Nothing waiting for approval.
          </Card>
        ) : (
          <BonusTable rows={pending} mode="pending" className="mt-4" />
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-base tracking-tight">History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved bonuses (newest first).
        </p>
        {approved.length === 0 ? (
          <Card className="glass-panel mt-4 p-6 text-sm text-muted-foreground">
            No approved bonuses yet.
          </Card>
        ) : (
          <BonusTable rows={approved} mode="history" className="mt-4" />
        )}
      </section>
    </AppShell>
  );
}

function BonusTable({
  rows,
  mode,
  className,
}: {
  rows: ManualBonusView[];
  mode: "pending" | "history";
  className?: string;
}) {
  return (
    <Card className={cn("glass-panel overflow-hidden py-0", className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Period</th>
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5 font-medium">Amount</th>
            <th className="px-4 py-2.5 font-medium">Note</th>
            <th className="px-4 py-2.5 font-medium">
              {mode === "pending" ? "Logged by" : "Approved"}
            </th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-2.5 font-medium">{b.periodLabel}</td>
              <td className="px-4 py-2.5">{b.agentName}</td>
              <td className="px-4 py-2.5 tabular-nums font-semibold text-money">
                {money(b.amount)}
              </td>
              <td className="max-w-xs px-4 py-2.5 text-muted-foreground">{b.note}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {mode === "pending" ? (
                  <>
                    {b.createdByName}
                    <span className="mx-1">·</span>
                    {formatWhen(b.createdAt)}
                  </>
                ) : (
                  <>
                    {b.approvedByName || "—"}
                    {b.approvedAt ? (
                      <>
                        <span className="mx-1">·</span>
                        {formatWhen(b.approvedAt)}
                      </>
                    ) : null}
                    <span className="mt-0.5 block text-[11px]">
                      Logged by {b.createdByName}
                    </span>
                  </>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge
                    variant={mode === "pending" ? "outline" : "secondary"}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {mode === "pending" ? "Pending" : "Approved"}
                  </Badge>
                  {b.periodId && b.agentPeriodId ? (
                    <Link
                      href={`/portal/period/${b.periodId}/agent/${b.agentPeriodId}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-8",
                      )}
                    >
                      Open
                    </Link>
                  ) : null}
                  {mode === "pending" ? (
                    <ApproveManualBonusButton
                      bonusId={b.id}
                      agentName={b.agentName}
                      periodLabel={b.periodLabel}
                      amount={b.amount}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
