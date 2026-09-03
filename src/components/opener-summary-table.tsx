import Link from "next/link";
import { money } from "@/lib/format";
import type { OpenerSummaryRow } from "@/lib/opener/logs";
import { OpenerExportButton } from "@/app/admin/openers/opener-export-button";
import { OpenerUpscoreInput } from "@/app/admin/openers/opener-upscore-input";

function signLabel(status: string | undefined) {
  if (status === "fully_signed") return "Fully signed";
  if (status === "agent_signed") return "Awaiting manager";
  return "Not signed";
}

export function OpenerSummaryTable({
  rows,
  detailBase,
  monthLabel,
  canEditUpscore = false,
  locked = false,
  signStatus,
}: {
  rows: OpenerSummaryRow[];
  detailBase: "/admin/openers" | "/manager/openers";
  monthLabel: string;
  canEditUpscore?: boolean;
  locked?: boolean;
  signStatus?: Map<string, string>;
}) {
  const qs = monthLabel ? `?month=${monthLabel}` : "";
  const totals = rows.reduce(
    (acc, r) => {
      acc.approvedTransfers += r.approvedTransfers;
      acc.commissionTotal += r.commissionTotal;
      acc.upscore += r.upscore;
      acc.totalPayout += r.totalPayout;
      acc.excludedCanceled += r.excludedCanceled;
      acc.pendingCrmReview += r.pendingCrmReview;
      return acc;
    },
    {
      approvedTransfers: 0,
      commissionTotal: 0,
      upscore: 0,
      totalPayout: 0,
      excludedCanceled: 0,
      pendingCrmReview: 0,
    },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Only rows marked Approved count toward Commission Total. Check Pending
          CRM Review is 0 for every opener before payroll. Bonus / Upscore is
          entered here and included in Total Payout.
        </p>
        {monthLabel ? <OpenerExportButton monthLabel={monthLabel} /> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Opener</th>
              <th className="px-4 py-2.5 text-right font-medium">Approved Transfers</th>
              <th className="px-4 py-2.5 text-right font-medium">Commission Total</th>
              <th className="px-4 py-2.5 text-right font-medium">
                Bonus / Upscore
              </th>
              <th className="px-4 py-2.5 text-right font-medium">Total Payout</th>
              <th className="px-4 py-2.5 text-right font-medium">
                Excluded (Canceled)
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                Pending CRM Review
              </th>
              <th className="px-4 py-2.5 font-medium">Statement</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No opener logins yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.agentId} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={`${detailBase}/${r.agentId}${qs}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.approvedTransfers}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(r.commissionTotal)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditUpscore && monthLabel && !locked ? (
                      <OpenerUpscoreInput
                        agentId={r.agentId}
                        monthLabel={monthLabel}
                        amount={r.upscore}
                      />
                    ) : (
                      <span className="tabular-nums">{money(r.upscore)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(r.totalPayout)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.excludedCanceled}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.pendingCrmReview}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/portal/opener/statement/${r.agentId}?month=${monthLabel}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {signLabel(signStatus?.get(r.agentId))}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-medium">
                <td className="px-4 py-2.5">Grand Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {totals.approvedTransfers}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(totals.commissionTotal)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(totals.upscore)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(totals.totalPayout)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {totals.excludedCanceled}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {totals.pendingCrmReview}
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
