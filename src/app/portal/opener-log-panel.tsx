"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  OPENER_PAY_APPROVED,
  type OpenerForthSnapshot,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import {
  createOpenerLogAction,
  deleteOpenerLogAction,
  updateOpenerLogDateAction,
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

type LookupResponse = {
  snapshot: OpenerForthSnapshot;
  debtTooLow: boolean;
  existing: { agentId: string; displayName: string; mine: boolean } | null;
};

export function OpenerTransfersPanel({
  todayYmd,
  rows,
  monthLabel,
  periods,
}: {
  todayYmd: string;
  rows: OpenerLogRowView[];
  monthLabel: string;
  periods: string[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createOpenerLogAction,
    null as OpenerLogActionResult | null,
  );
  const [forthId, setForthId] = useState("");
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    const id = forthId.trim();
    if (!id) {
      setLookup(null);
      return;
    }
    const t = setTimeout(() => {
      setLookupBusy(true);
      fetch(`/api/portal/opener/lookup?forthId=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((data: LookupResponse & { error?: string }) => {
          if (data.error) {
            setLookup(null);
            return;
          }
          setLookup(data);
        })
        .catch(() => setLookup(null))
        .finally(() => setLookupBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [forthId]);

  useEffect(() => {
    if (createState?.ok) setForthId("");
  }, [createState]);

  const approved = useMemo(
    () => rows.filter((r) => r.payStatus === OPENER_PAY_APPROVED),
    [rows],
  );
  const approvedTotal = approved.reduce((s, r) => s + r.commission, 0);
  const snap = lookup?.snapshot;
  const blockSave = Boolean(lookup?.debtTooLow || lookup?.existing);

  return (
    <div className="mt-8 space-y-6">
      <OpenerPeriodPicker
        periods={periods}
        selected={monthLabel}
        pathname="/portal"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="glass-panel px-4 py-3">
          <p className="text-xs text-muted-foreground">Approved transfers</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{approved.length}</p>
        </Card>
        <Card className="glass-panel px-4 py-3">
          <p className="text-xs text-muted-foreground">Commission total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-money">
            {money(approvedTotal)}
          </p>
        </Card>
      </div>

      <Card className="glass-panel p-4 sm:p-5">
        <h2 className="font-heading text-lg tracking-tight">Log a transfer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter File ID (Forth id). Stage, status, debt load, and commission fill from Forth.
        </p>
        <form action={createAction} className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="transferYmd">Date</Label>
            <Input id="transferYmd" name="transferYmd" type="date" required defaultValue={todayYmd} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forthId">File ID</Label>
            <Input
              id="forthId"
              name="forthId"
              required
              value={forthId}
              onChange={(e) => setForthId(e.target.value)}
              placeholder="Forth contact id"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={createPending || blockSave} size="sm" className="sm:mb-0.5">
            {createPending ? "Saving…" : "Save"}
          </Button>
        </form>

        {forthId.trim() ? (
          <div className="mt-4 overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Debt Load (CRM)</th>
                  <th className="px-3 py-2 font-medium">Stage (CRM)</th>
                  <th className="px-3 py-2 font-medium">Status (CRM)</th>
                  <th className="px-3 py-2 font-medium">Commission</th>
                  <th className="px-3 py-2 font-medium">Pay Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 tabular-nums">
                    {lookupBusy ? "…" : snap && !snap.unmatched ? money(snap.debtLoad) : "—"}
                  </td>
                  <td className="px-3 py-2">{lookupBusy ? "…" : snap?.stageTitle || "—"}</td>
                  <td className="px-3 py-2">{lookupBusy ? "…" : snap?.status || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {lookupBusy ? "…" : snap && !snap.unmatched ? money(snap.commission) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {lookupBusy
                      ? "…"
                      : snap
                        ? formatOpenerPayStatus(snap.payStatus)
                        : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {lookup?.existing ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Already logged</AlertTitle>
            <AlertDescription>
              {lookup.existing.mine
                ? "You already logged this File ID."
                : `Logged by ${lookup.existing.displayName}.`}
            </AlertDescription>
          </Alert>
        ) : null}
        {lookup?.debtTooLow ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Debt load too low</AlertTitle>
            <AlertDescription>Debt load must be at least $5,000 to log this file.</AlertDescription>
          </Alert>
        ) : null}
        {lookup?.snapshot.unmatched && !lookup.existing ? (
          <Alert className="mt-3">
            <AlertTitle>Not in Forth yet</AlertTitle>
            <AlertDescription>
              You can still save. Stage, status, and debt load will fill in when Forth syncs.
            </AlertDescription>
          </Alert>
        ) : null}
        {createState?.ok === false ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Couldn’t save</AlertTitle>
            <AlertDescription>{createState.error}</AlertDescription>
          </Alert>
        ) : null}
        {createState?.ok === true && createState.warning ? (
          <Alert className="mt-3">
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{createState.warning}</AlertDescription>
          </Alert>
        ) : null}
      </Card>

      <Card className="glass-panel overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>File ID</TableHead>
              <TableHead>Debt Load (CRM)</TableHead>
              <TableHead>Stage (CRM)</TableHead>
              <TableHead>Status (CRM)</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Pay Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No transfers logged in {monthLabel}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => <OpenerLogRow key={r.id} row={r} />)
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OpenerLogRow({ row }: { row: OpenerLogRowView }) {
  const [dateState, dateAction, datePending] = useActionState(
    updateOpenerLogDateAction,
    null as OpenerLogActionResult | null,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteOpenerLogAction,
    null as OpenerLogActionResult | null,
  );

  return (
    <TableRow>
      <TableCell>
        <form
          action={dateAction}
          onChange={(e) => {
            const form = e.currentTarget;
            const next = String(new FormData(form).get("transferYmd") || "");
            if (next && next !== row.transferYmd) form.requestSubmit();
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <Input
            type="date"
            name="transferYmd"
            defaultValue={row.transferYmd}
            disabled={datePending}
            className="h-8 w-[10.5rem]"
          />
        </form>
        {dateState?.ok === false ? (
          <p className="mt-1 text-xs text-destructive">{dateState.error}</p>
        ) : null}
      </TableCell>
      <TableCell className="font-medium tabular-nums">
        {row.forthId}
        {row.unmatched ? (
          <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-amber-800">
            Unmatched
          </span>
        ) : null}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.unmatched ? "—" : money(row.debtLoad)}
      </TableCell>
      <TableCell>{row.stageTitle || "—"}</TableCell>
      <TableCell>{row.status || "—"}</TableCell>
      <TableCell className="tabular-nums">
        {row.unmatched ? "—" : money(row.commission)}
      </TableCell>
      <TableCell>{formatOpenerPayStatus(row.payStatus)}</TableCell>
      <TableCell>
        <OpenerNotesInput
          logId={row.id}
          notes={row.notes}
          action={updateOpenerLogNotesAction}
        />
      </TableCell>
      <TableCell className="text-right">
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
        {delState?.ok === false ? (
          <p className="mt-1 text-xs text-destructive">{delState.error}</p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
