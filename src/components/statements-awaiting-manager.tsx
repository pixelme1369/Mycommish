import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import type { AwaitingManagerStatementRow } from "@/lib/statements";

export function StatementsAwaitingManager({
  rows,
  viewBase,
}: {
  rows: AwaitingManagerStatementRow[];
  /** `/admin` or `/manager` — detail links still go through portal period path. */
  viewBase: "/admin" | "/manager";
}) {
  return (
    <section>
      <h2 className="font-heading text-xl tracking-tight">Awaiting manager signature</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Agents who signed their commission statement and need a countersignature.
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">None waiting right now.</p>
      ) : (
        <Card className="glass-panel mt-4 overflow-hidden py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Net</th>
                <th className="px-4 py-2.5 font-medium">Agent signed</th>
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
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.periodId && r.agentPeriodId ? (
                      <Link
                        href={`/portal/period/${r.periodId}/agent/${r.agentPeriodId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                        title={`Open from ${viewBase}`}
                      >
                        Countersign →
                      </Link>
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
    </section>
  );
}
