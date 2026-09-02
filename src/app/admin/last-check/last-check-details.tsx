import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { money, ratePercent } from "@/lib/format";
import type { LastCheckView } from "@/lib/agents/last-check-load";

export function LastCheckDetails({ view }: { view: LastCheckView }) {
  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Threshold files · enrolled</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {view.units}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              · {money(view.enrolledDebt)}
            </span>
          </p>
        </Card>
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Commission</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {money(view.grossCommission)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.tierLabel}
            {view.units > 0 && view.tierRate > 0 ? ` · ${ratePercent(view.tierRate)}` : ""}
          </p>
        </Card>
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Clawbacks</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight text-destructive">
            −{money(view.clawbackAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.clawbacks.length} from upcoming periods
          </p>
        </Card>
        <Card className="glass-panel p-4">
          <p className="text-xs text-muted-foreground">Pay on Gusto</p>
          <p className="mt-1 font-heading text-2xl tabular-nums tracking-tight">
            {money(view.gustoAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.gustoEmployeeId
              ? `ID ${view.gustoEmployeeId}`
              : "Add Gusto ID on Users if missing"}
          </p>
        </Card>
      </div>

      {view.notes ? (
        <p className="mt-4 text-sm text-muted-foreground">{view.notes}</p>
      ) : null}

      <section className="mt-8">
        <h2 className="font-heading text-base tracking-tight">
          Threshold files{" "}
          <Badge variant="secondary" className="ml-1 font-normal">
            {view.files.length}
          </Badge>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Commission files from upcoming periods that passed the payment threshold.
          Files that were going to be commissioned but have not hit threshold are not
          paid. Monthly needs 2 payments and a 2nd clear date. Bi-weekly and
          semi-monthly need 4 payments.
        </p>
        {view.files.length === 0 ? (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            No upcoming commission files have passed the payment threshold.
          </Card>
        ) : (
          <Card className="glass-panel mt-3 overflow-x-auto py-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">External ID</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 text-right font-medium">Enrolled debt</th>
                  <th className="px-3 py-2 text-right font-medium">Commission</th>
                  <th className="px-3 py-2 text-right font-medium">Payments</th>
                  <th className="px-3 py-2 font-medium">Pay freq</th>
                  <th className="px-3 py-2 font-medium">1st clear</th>
                  <th className="px-3 py-2 font-medium">2nd clear</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {view.files.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {f.periodLabel}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {f.externalId || f.crmId}
                    </td>
                    <td className="px-3 py-2">{f.clientName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(f.enrolledDebt)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(f.commission)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={f.thresholdPassed ? "text-money" : undefined}>
                        {f.paymentsMade}
                        <span className="text-muted-foreground"> / {f.paymentsNeeded}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{f.payFreq || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {f.firstPaymentClearedDate || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {f.secondPaymentClearedDate ? (
                        <span className="text-money">{f.secondClearLabel}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{f.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-base tracking-tight">
          Clawbacks{" "}
          <Badge variant="secondary" className="ml-1 font-normal">
            {view.clawbacks.length}
          </Badge>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deducted from this last check so they are not left on a later Gusto run.
        </p>
        {view.clawbacks.length === 0 ? (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            No clawbacks on upcoming periods.
          </Card>
        ) : (
          <Card className="glass-panel mt-3 overflow-x-auto py-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">External ID</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 text-right font-medium">Enrolled debt</th>
                  <th className="px-3 py-2 text-right font-medium">Clawback</th>
                  <th className="px-3 py-2 font-medium">Pay freq</th>
                  <th className="px-3 py-2 font-medium">Dropped</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {view.clawbacks.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {c.periodLabel}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.externalId || c.crmId}
                    </td>
                    <td className="px-3 py-2">{c.clientName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(c.enrolledDebt)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      −{money(c.clawbackAmount)}
                    </td>
                    <td className="px-3 py-2">{c.payFreq || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{c.droppedDate || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}
