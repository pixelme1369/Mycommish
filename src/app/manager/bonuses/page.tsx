import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import {
  listBonusRecipientAgents,
  listMyBonuses,
  sumMyOwedBonuses,
} from "@/lib/manager-bonuses";
import { LogBonusForm } from "./log-bonus-form";
import { deleteManagerBonusAction } from "./actions";
import { PaidOnDate } from "@/components/paid-on-date";

export const dynamic = "force-dynamic";

export default async function ManagerBonusesPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const agentId = session.user.agentId;
  if (!agentId) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Not signed in.</p>
      </AppShell>
    );
  }

  const [agents, rows, owedTotal] = await Promise.all([
    listBonusRecipientAgents(),
    listMyBonuses(agentId),
    sumMyOwedBonuses(agentId),
  ]);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <Link
            href="/manager"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            ← Manager
          </Link>
        }
        title="Bonus payouts"
        description="Log agent bonuses you paid from your account — reimbursed on commission pay date"
        actions={
          <>
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <Card className="glass-panel mt-8 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Owed to you</span>
          <span className="mx-2 text-border">·</span>
          <span className="font-semibold text-money tabular-nums">{money(owedTotal)}</span>
          <span className="text-muted-foreground"> unpaid across all periods</span>
        </p>
      </Card>

      <section className="mt-8">
        <h2 className="font-heading text-base tracking-tight">Log a payout</h2>
        <Card className="glass-panel mt-3 px-4 py-4">
          <LogBonusForm agents={agents} />
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-base tracking-tight">
          Your history{" "}
          <span className="text-sm font-sans font-normal text-muted-foreground">
            ({rows.length})
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No bonuses logged yet.</p>
        ) : (
          <Card className="glass-panel mt-3 overflow-x-auto py-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Paid on</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <PaidOnDate date={r.paidOn} />
                    </td>
                    <td className="px-3 py-2">{r.recipientName}</td>
                    <td className="px-3 py-2">{r.reason}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.periodLabel}</td>
                    <td className="px-3 py-2 tabular-nums">{money(r.amount)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "owed" ? "secondary" : "outline"}>
                        {r.status === "owed" ? "Owed" : "Reimbursed"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "owed" ? (
                        <form action={deleteManagerBonusAction}>
                          <input type="hidden" name="bonusId" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
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
