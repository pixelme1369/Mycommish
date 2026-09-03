import { money } from "@/lib/format";
import {
  formatOpenerPayStatus,
  openerCommissionForPayStatus,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { OpenerPayStatusSelect } from "./pay-status-select";
import { OpenerNotesInput } from "./opener-notes-input";
import { setOpenerLogNotesStaffAction } from "./actions";

export type OpenerDetailRow = {
  id: string;
  transferYmd: string;
  forthId: string;
  debtLoad: number;
  stageTitle: string | null;
  status: string | null;
  commission: number;
  payStatus: OpenerPayStatusName;
  payStatusOverridden: boolean;
  unmatched: boolean;
  notes: string;
};

export function OpenerDetailTable({
  rows,
  canEditPayStatus,
  locked = false,
}: {
  rows: OpenerDetailRow[];
  canEditPayStatus: boolean;
  locked?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Transfer Date</th>
            <th className="px-3 py-2.5 font-medium">File ID</th>
            <th className="px-3 py-2.5 font-medium">Debt Load (CRM)</th>
            <th className="px-3 py-2.5 font-medium">Stage (CRM)</th>
            <th className="px-3 py-2.5 font-medium">Status (CRM)</th>
            <th className="px-3 py-2.5 font-medium">Commission</th>
            <th className="px-3 py-2.5 font-medium">Pay Status</th>
            <th className="px-3 py-2.5 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                No transfers logged.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={
                  formatOpenerPayStatus(r.payStatus) === "Excluded - Canceled"
                    ? "border-t border-border bg-red-50"
                    : "border-t border-border"
                }
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.transferYmd}</td>
                <td className="px-3 py-2 font-medium tabular-nums">
                  {r.forthId}
                  {r.unmatched ? (
                    <span className="ml-2 text-[11px] font-normal tracking-wide text-amber-800">
                      Not Enrolled
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {r.unmatched ? "—" : money(r.debtLoad)}
                </td>
                <td className="px-3 py-2">{r.stageTitle || "—"}</td>
                <td className="px-3 py-2">{r.status || "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.unmatched ? "—" : money(openerCommissionForPayStatus(r.debtLoad, r.payStatus))}
                </td>
                <td className="px-3 py-2">
                  {canEditPayStatus && !locked ? (
                    <OpenerPayStatusSelect
                      logId={r.id}
                      payStatus={r.payStatus}
                      overridden={r.payStatusOverridden}
                    />
                  ) : (
                    formatOpenerPayStatus(r.payStatus)
                  )}
                </td>
                <td className="px-3 py-2">
                  {locked ? (
                    <span className="text-muted-foreground">{r.notes || "—"}</span>
                  ) : (
                    <OpenerNotesInput
                      logId={r.id}
                      notes={r.notes}
                      action={setOpenerLogNotesStaffAction}
                    />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
