"use client";

import { useActionState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money } from "@/lib/format";
import {
  formatOpenerPayStatus,
  formatOpenerPeriodName,
  formatOpenerTransferDay,
  openerCommissionForPayStatus,
  openerMonthDays,
  OPENER_PAY_APPROVED,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import {
  deleteOpenerLogAction,
  updateOpenerLogNotesAction,
} from "@/app/portal/opener-actions";
import { OpenerNotesInput } from "@/app/admin/openers/opener-notes-input";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

export type OpenerLogRowView = {
  id: string;
  transferYmd: string;
  forthId: string;
  debtLoad: number;
  stageTitle: string | null;
  status: string | null;
  commission: number;
  payStatus: OpenerPayStatusName;
  unmatched: boolean;
  notes: string;
};

export function OpenerTransfersPanel({
  rows,
  monthLabel,
  periods,
  locked = false,
}: {
  todayYmd: string;
  rows: OpenerLogRowView[];
  monthLabel: string;
  periods: string[];
  locked?: boolean;
}) {
  const approved = useMemo(
    () => rows.filter((r) => r.payStatus === OPENER_PAY_APPROVED),
    [rows],
  );
  const approvedTotal = approved.reduce(
    (s, r) => s + openerCommissionForPayStatus(r.debtLoad, r.payStatus),
    0,
  );
  const periodName = formatOpenerPeriodName(monthLabel);

  return (
    <div className="mt-6 space-y-4">
      <OpenerPeriodPicker
        periods={periods}
        selected={monthLabel}
        pathname="/portal"
        stats={
          rows.length > 0 ? (
            <p className="pb-0.5 text-sm tabular-nums text-muted-foreground">
              {approved.length} approved{" "}
              <span className="text-muted-foreground/60">·</span>{" "}
              <span className="font-medium text-money">{money(approvedTotal)}</span>
            </p>
          ) : null
        }
      />

      <Card className="glass-panel overflow-hidden py-0">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg tracking-tight">My transfers</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Filled automatically from Forth (Transfer Agent, Transferred Date, debt). Notes
                still editable here.
              </p>
            </div>
            {locked ? (
              <p className="text-sm text-muted-foreground">This pay period is closed.</p>
            ) : null}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Transfer Date</TableHead>
              <TableHead>File ID</TableHead>
              <TableHead>Debt Load</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Pay Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No Forth transfers for you in {periodName} yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <OpenerLogRow key={r.id} row={r} locked={locked} />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OpenerLogRow({
  row,
  locked,
}: {
  row: OpenerLogRowView;
  locked: boolean;
}) {
  const [delState, delAction, delPending] = useActionState(
    deleteOpenerLogAction,
    null as OpenerLogActionResult | null,
  );

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap tabular-nums">
        {formatOpenerTransferDay(row.transferYmd)}
      </TableCell>
      <TableCell className="font-medium tabular-nums">
        {row.forthId}
        {row.unmatched ? (
          <span className="ml-2 text-[11px] font-normal tracking-wide text-amber-800">
            Not Enrolled
          </span>
        ) : null}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.unmatched ? "—" : money(row.debtLoad)}
      </TableCell>
      <TableCell>{row.stageTitle || "—"}</TableCell>
      <TableCell>{row.status || "—"}</TableCell>
      <TableCell className="tabular-nums">
        {row.unmatched ? "—" : money(openerCommissionForPayStatus(row.debtLoad, row.payStatus))}
      </TableCell>
      <TableCell>{formatOpenerPayStatus(row.payStatus)}</TableCell>
      <TableCell>
        {locked ? (
          <span className="text-sm text-muted-foreground">{row.notes || "—"}</span>
        ) : (
          <OpenerNotesInput
            logId={row.id}
            notes={row.notes}
            action={updateOpenerLogNotesAction}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {locked ? null : (
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm("Delete this transfer log?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" variant="ghost" size="sm" disabled={delPending}>
              {delPending ? "…" : "Delete"}
            </Button>
          </form>
        )}
        {delState?.ok === false ? (
          <p className="mt-1 text-xs text-destructive">{delState.error}</p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
