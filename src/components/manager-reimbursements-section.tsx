import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  groupBonusesByManager,
  payDateLabel,
  type ManagerBonusRow,
} from "@/lib/manager-bonuses";
import {
  markBonusReimbursedAction,
  markManagerPeriodBonusesReimbursedAction,
  undoBonusReimbursedAction,
} from "@/app/manager/bonuses/actions";

export function ManagerReimbursementsSection({
  periodLabel,
  rows,
  adminControls,
}: {
  periodLabel: string;
  rows: ManagerBonusRow[];
  adminControls: boolean;
}) {
  const groups = groupBonusesByManager(rows);
  const owedGrand = groups.reduce((s, g) => s + g.owedTotal, 0);
  const payDate = payDateLabel(periodLabel);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-base tracking-tight">Manager reimbursements</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Out-of-pocket agent bonuses for {periodLabel} · pay date {payDate}
          </p>
        </div>
        {owedGrand > 0 ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Total owed </span>
            <span className="font-semibold text-money tabular-nums">{money(owedGrand)}</span>
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No manager bonuses logged for this period.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {groups.map((g) => (
            <Card key={g.paidById} className="glass-panel overflow-hidden py-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{g.paidByName}</p>
                  <p className="text-xs text-muted-foreground">
                    Owed {money(g.owedTotal)}
                    {g.reimbursedTotal > 0 ? ` · reimbursed ${money(g.reimbursedTotal)}` : ""}
                  </p>
                </div>
                {adminControls && g.owed.length > 0 ? (
                  <form action={markManagerPeriodBonusesReimbursedAction}>
                    <input type="hidden" name="periodLabel" value={periodLabel} />
                    <input type="hidden" name="paidById" value={g.paidById} />
                    <Button type="submit" size="sm" variant="outline">
                      Mark all reimbursed
                    </Button>
                  </form>
                ) : null}
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border/70 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Paid on</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {adminControls ? <th className="px-3 py-2 font-medium" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {[...g.owed, ...g.reimbursed].map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 tabular-nums">
                        {r.paidOn.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-3 py-2">{r.recipientAgent.displayName}</td>
                      <td className="px-3 py-2">{r.reason}</td>
                      <td className="px-3 py-2 tabular-nums">{money(r.amount)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "owed" ? "secondary" : "outline"}>
                          {r.status === "owed" ? "Owed" : "Reimbursed"}
                        </Badge>
                      </td>
                      {adminControls ? (
                        <td className="px-3 py-2 text-right">
                          {r.status === "owed" ? (
                            <form action={markBonusReimbursedAction}>
                              <input type="hidden" name="bonusId" value={r.id} />
                              <button
                                type="submit"
                                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              >
                                Mark reimbursed
                              </button>
                            </form>
                          ) : (
                            <form action={undoBonusReimbursedAction}>
                              <input type="hidden" name="bonusId" value={r.id} />
                              <button
                                type="submit"
                                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              >
                                Undo
                              </button>
                            </form>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
