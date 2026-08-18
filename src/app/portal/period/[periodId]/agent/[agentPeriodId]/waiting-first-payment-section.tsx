"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaitingFirstPaymentRow } from "@/lib/portal/queries";

type SortKey = "enrolledDebt" | "firstPaymentDate";
type SortDir = "asc" | "desc";

function dateSortValue(raw: string | null): number {
  const v = (raw || "").trim();
  if (!v) return Number.POSITIVE_INFINITY;
  const mdy2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(v);
  if (mdy2) {
    return Date.UTC(2000 + Number(mdy2[3]), Number(mdy2[1]) - 1, Number(mdy2[2]));
  }
  const mdy4 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (mdy4) {
    return Date.UTC(Number(mdy4[3]), Number(mdy4[1]) - 1, Number(mdy4[2]));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        <span className="w-3 text-[10px] tabular-nums" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

export function WaitingFirstPaymentSection({ rows }: { rows: WaitingFirstPaymentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("firstPaymentDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "enrolledDebt") {
        const av = a.enrolledDebt ?? Number.NEGATIVE_INFINITY;
        const bv = b.enrolledDebt ?? Number.NEGATIVE_INFINITY;
        cmp = av - bv;
      } else {
        cmp = dateSortValue(a.firstPaymentDate) - dateSortValue(b.firstPaymentDate);
      }
      if (cmp === 0) {
        cmp = (a.clientName || "").localeCompare(b.clientName || "") || a.crmId.localeCompare(b.crmId);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "firstPaymentDate" ? "asc" : "desc");
  };

  return (
    <section className="mt-8">
      <h2 className="font-heading text-base tracking-tight">
        Waiting For First Payment{" "}
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Not in commission yet — 1st payment is scheduled this period but not cleared. Follow up so
        they clear and count toward your units.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No files waiting for first payment.</p>
      ) : (
        <Card className="glass-panel mt-3 overflow-x-auto py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">AMOD</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <SortTh
                  label="Enrolled debt"
                  sortKey="enrolledDebt"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortTh
                  label="1st payment date"
                  sortKey="firstPaymentDate"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {sorted.map((c) => (
                <tr key={c.crmId}>
                  <td className="px-3 py-2 font-mono text-xs">{c.externalId || c.crmId}</td>
                  <td className="px-3 py-2">{c.clientName || "—"}</td>
                  <td className="px-3 py-2">
                    {c.enrolledDebt != null ? money(c.enrolledDebt) : "—"}
                  </td>
                  <td className="px-3 py-2">{c.firstPaymentDate || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.crmStatus || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
