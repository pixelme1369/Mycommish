"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaidOnDate } from "@/components/paid-on-date";
import {
  markBonusReimbursedAction,
  markManagerPeriodBonusesReimbursedAction,
  undoBonusReimbursedAction,
} from "@/app/manager/bonuses/actions";

export type SerializedBonusRow = {
  id: string;
  amount: number;
  reason: string;
  paidOn: string;
  periodLabel: string;
  status: "owed" | "reimbursed";
  reimbursedAt: string | null;
  paidBy: { id: string; displayName: string; role: "admin" | "manager" | "agent" };
  recipientName: string;
  recipientAgentId: string | null;
};

export type SerializedBonusGroup = {
  paidById: string;
  paidByName: string;
  paidByRole: "admin" | "manager" | "agent";
  owed: SerializedBonusRow[];
  reimbursed: SerializedBonusRow[];
  owedTotal: number;
  reimbursedTotal: number;
};

export function ManagerReimbursementsTable({
  periodLabel,
  payDate,
  owedGrand,
  groups,
  adminControls,
}: {
  periodLabel: string;
  payDate: string;
  owedGrand: number;
  groups: SerializedBonusGroup[];
  adminControls: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const empty = groups.length === 0;

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

      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">No manager bonuses logged for this period.</p>
      ) : (
        <Card className="glass-panel mt-3 overflow-x-auto py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Manager</th>
                <th className="px-3 py-2 font-medium">Payouts</th>
                <th className="px-3 py-2 font-medium">Owed</th>
                <th className="px-3 py-2 font-medium">Reimbursed</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {groups.map((g) => {
                const open = openId === g.paidById;
                const payoutCount = g.owed.length + g.reimbursed.length;
                return (
                  <ManagerSummaryRows
                    key={g.paidById}
                    group={g}
                    periodLabel={periodLabel}
                    adminControls={adminControls}
                    open={open}
                    payoutCount={payoutCount}
                    onToggle={() => setOpenId(open ? null : g.paidById)}
                  />
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function ManagerSummaryRows({
  group: g,
  periodLabel,
  adminControls,
  open,
  payoutCount,
  onToggle,
}: {
  group: SerializedBonusGroup;
  periodLabel: string;
  adminControls: boolean;
  open: boolean;
  payoutCount: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={open ? "bg-muted/20" : undefined}>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{g.paidByName}</span>
            {g.paidByRole === "manager" || g.paidByRole === "admin" ? (
              <Badge variant="outline" className="h-5 text-[10px] uppercase tracking-wide">
                {g.paidByRole}
              </Badge>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{payoutCount}</td>
        <td className="px-3 py-2.5 tabular-nums font-medium text-money">
          {g.owedTotal > 0 ? money(g.owedTotal) : "—"}
        </td>
        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
          {g.reimbursedTotal > 0 ? money(g.reimbursedTotal) : "—"}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onToggle}>
              {open ? "Hide" : "View"}
            </Button>
            {adminControls && g.owed.length > 0 ? (
              <form action={markManagerPeriodBonusesReimbursedAction}>
                <input type="hidden" name="periodLabel" value={periodLabel} />
                <input type="hidden" name="paidById" value={g.paidById} />
                <Button type="submit" size="sm" variant="secondary">
                  Mark all reimbursed
                </Button>
              </form>
            ) : null}
          </div>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="bg-muted/10 p-0">
            <div className="border-t border-border/70 px-3 py-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Payouts logged by {g.paidByName}
              </p>
              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border/70 bg-muted/30 text-muted-foreground">
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
                        <td className="px-3 py-2">
                          <PaidOnDate date={r.paidOn} includeYear={false} />
                        </td>
                        <td className="px-3 py-2">{r.recipientName}</td>
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
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
