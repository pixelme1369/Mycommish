"use client";

import { useMemo } from "react";
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
  OPENER_PAY_APPROVED,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";

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
              <span className="font-semibold text-money">{money(approvedTotal)}</span>
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
                Filled automatically from Forth (Transfer Agent, Transferred Date, debt).
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No Forth transfers for you in {periodName} yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatOpenerTransferDay(r.transferYmd)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {r.forthId}
                    {r.unmatched ? (
                      <span className="ml-2 text-[11px] font-normal tracking-wide text-amber-800">
                        Not Enrolled
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.unmatched ? "—" : money(r.debtLoad)}
                  </TableCell>
                  <TableCell>{r.stageTitle || "—"}</TableCell>
                  <TableCell>{r.status || "—"}</TableCell>
                  <TableCell className="font-semibold tabular-nums text-money">
                    {r.unmatched
                      ? "—"
                      : money(openerCommissionForPayStatus(r.debtLoad, r.payStatus))}
                  </TableCell>
                  <TableCell>{formatOpenerPayStatus(r.payStatus)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
