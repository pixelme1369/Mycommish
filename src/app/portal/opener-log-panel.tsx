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
  clampYmdToOpenerMonth,
  formatOpenerPayStatus,
  formatOpenerPeriodName,
  formatOpenerTransferDay,
  openerMonthDays,
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
  locked = false,
}: {
  todayYmd: string;
  rows: OpenerLogRowView[];
  monthLabel: string;
  periods: string[];
  locked?: boolean;
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
  const transferDays = openerMonthDays(monthLabel);
  const defaultTransferYmd = clampYmdToOpenerMonth(todayYmd, monthLabel);
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
            <h2 className="font-heading text-lg tracking-tight">Log a transfer</h2>
            {locked ? (
              <p className="text-sm text-muted-foreground">This pay period is closed.</p>
            ) : null}
          </div>
          <form
            action={createAction}
            className="mt-4 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"
          >
            <input type="hidden" name="monthLabel" value={monthLabel} />
            <div className="space-y-1.5">
              <Label htmlFor="transferYmd">Transfer Date</Label>
              <OpenerTransferDateSelect
                key={`${monthLabel}-${defaultTransferYmd}`}
                id="transferYmd"
                name="transferYmd"
                days={transferDays}
                defaultValue={defaultTransferYmd}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forthId">File ID</Label>
              <Input
                id="forthId"
                name="forthId"
                required
                value={forthId}
                onChange={(e) => setForthId(e.target.value)}
                placeholder="File ID"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={createPending || blockSave || locked} className="h-9">
              {createPending ? "Saving…" : "Save"}
            </Button>
          </form>

          {forthId.trim() ? (
            <div className="mt-4 overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Debt Load</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Status</th>
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
                  No transfers in {periodName} yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <OpenerLogRow
                  key={r.id}
                  row={r}
                  locked={locked}
                  transferDays={transferDays}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OpenerTransferDateSelect({
  id,
  name,
  days,
  defaultValue,
  disabled,
  className,
}: {
  id?: string;
  name: string;
  days: string[];
  defaultValue: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      required
      defaultValue={defaultValue}
      disabled={disabled}
      className={
        className ??
        "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      }
    >
      {days.map((ymd) => (
        <option key={ymd} value={ymd}>
          {formatOpenerTransferDay(ymd)}
        </option>
      ))}
    </select>
  );
}

function OpenerLogRow({
  row,
  locked,
  transferDays,
}: {
  row: OpenerLogRowView;
  locked: boolean;
  transferDays: string[];
}) {
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
          <OpenerTransferDateSelect
            name="transferYmd"
            days={transferDays}
            defaultValue={row.transferYmd}
            disabled={datePending || locked}
            className="flex h-8 min-w-[9.5rem] rounded-lg border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!confirm("Delete this transfer log?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={delPending || locked}>
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
