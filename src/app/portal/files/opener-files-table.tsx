"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
  formatOpenerTransferDay,
  openerCommissionForPayStatus,
  OPENER_PAY_EXCLUDED,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";

export type OpenerFileRow = {
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
  openerName?: string;
};

export function OpenerFilesTable({ rows }: { rows: OpenerFileRow[] }) {
  const [q, setQ] = useState("");
  const showOpener = rows.some((r) => r.openerName);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.forthId.toLowerCase().includes(needle) ||
        (r.openerName || "").toLowerCase().includes(needle) ||
        (r.status || "").toLowerCase().includes(needle) ||
        (r.stageTitle || "").toLowerCase().includes(needle) ||
        (r.notes || "").toLowerCase().includes(needle) ||
        formatOpenerPayStatus(r.payStatus).toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          showOpener
            ? "Filter by opener, File ID, status, stage, or notes…"
            : "Filter by File ID, status, stage, or notes…"
        }
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? "No transfers logged yet." : "No files match."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Transfer Date</TableHead>
                {showOpener ? <TableHead>Opener</TableHead> : null}
                <TableHead>File ID</TableHead>
                <TableHead>Debt Load</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Pay Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className={
                    r.payStatus === OPENER_PAY_EXCLUDED ? "bg-red-50" : undefined
                  }
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatOpenerTransferDay(r.transferYmd)}
                  </TableCell>
                  {showOpener ? (
                    <TableCell className="whitespace-nowrap">
                      {r.openerName || "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium tabular-nums">
                    {r.forthId}
                    {r.unmatched ? (
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-amber-800">
                        Unmatched
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.unmatched ? "—" : money(r.debtLoad)}
                  </TableCell>
                  <TableCell>{r.stageTitle || "—"}</TableCell>
                  <TableCell>{r.status || "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.unmatched ? "—" : money(openerCommissionForPayStatus(r.debtLoad, r.payStatus))}
                  </TableCell>
                  <TableCell>{formatOpenerPayStatus(r.payStatus)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
