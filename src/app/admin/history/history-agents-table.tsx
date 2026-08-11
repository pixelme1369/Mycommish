"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cancelRatePercent, money, ratePercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HistoryAgentRow = {
  id: string;
  agentName: string;
  unitsCleared: number;
  adjustedTier: number;
  rawTier: number;
  cancellationPenaltyApplied: boolean;
  tierRate: number | string;
  grossCommission: number | string;
  clawbackAmount: number | string;
  netCommission: number | string;
  cancellationRate: number | string;
};

type SortKey =
  | "agentName"
  | "unitsCleared"
  | "adjustedTier"
  | "tierRate"
  | "grossCommission"
  | "clawbackAmount"
  | "netCommission"
  | "cancellationRate";

type SortDir = "asc" | "desc";

function num(v: number | string) {
  return Number(v) || 0;
}

function sortValue(row: HistoryAgentRow, key: SortKey): string | number {
  switch (key) {
    case "agentName":
      return row.agentName.toLowerCase();
    case "unitsCleared":
      return row.unitsCleared;
    case "adjustedTier":
      return row.adjustedTier;
    case "tierRate":
      return num(row.tierRate);
    case "grossCommission":
      return num(row.grossCommission);
    case "clawbackAmount":
      return num(row.clawbackAmount);
    case "netCommission":
      return num(row.netCommission);
    case "cancellationRate":
      return num(row.cancellationRate);
  }
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
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-zinc-900",
          active ? "text-zinc-900" : "text-zinc-600",
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

export function HistoryAgentsTable({
  periodId,
  agents,
}: {
  periodId: string;
  agents: HistoryAgentRow[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("netCommission");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    return [...agents].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) - (bv as number);
      }
      if (cmp === 0) cmp = a.agentName.localeCompare(b.agentName);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [agents, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "agentName" ? "asc" : "desc");
  };

  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
          <tr>
            <SortTh label="Agent" sortKey="agentName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Units" sortKey="unitsCleared" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Tier" sortKey="adjustedTier" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Rate" sortKey="tierRate" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Gross" sortKey="grossCommission" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="To subtract" sortKey="clawbackAmount" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Net" sortKey="netCommission" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortTh label="Cancel %" sortKey="cancellationRate" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium">{r.agentName}</td>
              <td className="px-4 py-3">{r.unitsCleared}</td>
              <td className="px-4 py-3">
                {r.cancellationPenaltyApplied
                  ? `${r.rawTier}→${r.adjustedTier}`
                  : r.adjustedTier || "—"}
              </td>
              <td className="px-4 py-3">{ratePercent(r.tierRate)}</td>
              <td className="px-4 py-3">{money(r.grossCommission)}</td>
              <td className="px-4 py-3">
                {Number(r.clawbackAmount) > 0 ? (
                  <span className="text-red-700">-{money(r.clawbackAmount)}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 font-semibold">{money(r.netCommission)}</td>
              <td className="px-4 py-3">{cancelRatePercent(r.cancellationRate)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/history/${periodId}/agent/${r.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  Clients →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
