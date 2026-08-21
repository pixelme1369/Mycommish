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
import { listPendingManualBonuses } from "@/lib/manual-bonuses";
import { ApproveManualBonusButton } from "@/components/approve-manual-bonus-button";

export const dynamic = "force-dynamic";

export default async function SuperAdminManualBonusesPage() {
  const session = await requireSuperAdmin();
  const pending = await listPendingManualBonuses();

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
        description="Manager-submitted bonuses waiting for your approval before they add to net commission."
        actions={<SignOutButton />}
      />

      {pending.length === 0 ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          Nothing waiting for approval.
        </Card>
      ) : (
        <Card className="glass-panel mt-8 overflow-hidden py-0">
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
              {pending.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2.5 font-medium">{b.periodLabel}</td>
                  <td className="px-4 py-2.5">{b.agentName}</td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-money">
                    {money(b.amount)}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-muted-foreground">{b.note}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {b.createdByName}
                    <span className="mx-1">·</span>
                    {new Date(b.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Pending
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
                      <ApproveManualBonusButton
                        bonusId={b.id}
                        agentName={b.agentName}
                        periodLabel={b.periodLabel}
                        amount={b.amount}
                      />
                    </div>
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
