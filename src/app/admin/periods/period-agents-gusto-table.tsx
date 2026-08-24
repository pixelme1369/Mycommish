"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cancelRatePercent, money, ratePercent } from "@/lib/format";
import { getFixedRate, unitsToNextTier } from "@/lib/commission/calculator";
import { resolveEmployment } from "@/lib/agents/contractors";
import { PeriodAgentRowActions } from "./period-agent-row-actions";

export type PeriodAgentRow = {
  id: string;
  agentName: string;
  unitsCleared: number;
  pendingUnits: number;
  adjustedTier: number;
  rawTier: number;
  cancellationPenaltyApplied: boolean;
  tierRate: number | string;
  grossCommission: number | string;
  clawbackAmount: number | string;
  netCommission: number | string;
  cancellationRate: number | string;
  dismissed?: boolean;
};

type SortKey =
  | "agentName"
  | "unitsCleared"
  | "pendingUnits"
  | "next"
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

function sortValue(row: PeriodAgentRow, key: SortKey): string | number {
  switch (key) {
    case "agentName":
      return row.agentName.toLowerCase();
    case "unitsCleared":
      return row.unitsCleared;
    case "pendingUnits":
      return row.pendingUnits;
    case "next": {
      const n = unitsToNextTier(row.unitsCleared, row.agentName);
      // Fixed / top tier sort after everyone when ascending
      return n == null ? Number.POSITIVE_INFINITY : n;
    }
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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={cn(
        "whitespace-nowrap px-2 py-2.5 font-medium",
        align === "right" ? "text-right" : "text-left",
        sortKey === "agentName" && "px-3",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
          align === "right" && "flex-row-reverse",
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

export function PeriodAgentsGustoTable({
  periodId,
  agents,
  dismissedCount = 0,
  readOnly = false,
}: {
  periodId: string;
  agents: PeriodAgentRow[];
  dismissedCount?: number;
  /** Managers: view + navigate only — no Gusto, select, or dismiss. */
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [exportKind, setExportKind] = useState<"gusto" | "history" | "details" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("netCommission");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visibleAgents = useMemo(() => {
    const filtered =
      readOnly || !showDismissed ? agents.filter((a) => !a.dismissed) : agents;
    const sorted = [...filtered].sort((a, b) => {
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
    return sorted;
  }, [agents, showDismissed, sortKey, sortDir, readOnly]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Names default A→Z; money/units default high→low
    setSortDir(key === "agentName" ? "asc" : "desc");
  };

  const allIds = useMemo(() => visibleAgents.map((a) => a.id), [visibleAgents]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allIds.every((id) => prev.has(id))) return new Set();
      return new Set(allIds);
    });
  };

  const exportGusto = () => {
    setMessage(null);
    setError(null);
    setExportKind("gusto");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/periods/${periodId}/gusto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentPeriodIds: [...selected] }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Export failed");
          return;
        }

        const metaRaw = res.headers.get("X-Gusto-Meta");
        const meta = metaRaw
          ? (JSON.parse(metaRaw) as {
              employeeCount: number;
              contractorCount: number;
              missingGustoId: string[];
              missingEin: string[];
              filename: string;
            })
          : null;

        const blob = await res.blob();
        const filename =
          meta?.filename ||
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ||
          "gusto-export.xlsx";
        downloadBlob(filename, blob);

        const parts = [
          meta?.employeeCount ? `${meta.employeeCount} Agents` : null,
          meta?.contractorCount ? `${meta.contractorCount} Contractors` : null,
        ].filter(Boolean);
        let msg = `Downloaded ${filename}${parts.length ? ` · ${parts.join(", ")}` : ""}.`;
        const warns: string[] = [];
        if (meta?.missingGustoId?.length) {
          warns.push(`missing Gusto ID: ${meta.missingGustoId.join(", ")}`);
        }
        if (meta?.missingEin?.length) {
          warns.push(`missing EIN: ${meta.missingEin.join(", ")}`);
        }
        if (warns.length) msg += ` Check ${warns.join("; ")}.`;
        setMessage(msg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExportKind(null);
      }
    });
  };

  const exportCommissionHistory = () => {
    setMessage(null);
    setError(null);
    setExportKind("history");
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/periods/${periodId}/commission-history`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentPeriodIds: [...selected] }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Export failed");
          return;
        }

        const metaRaw = res.headers.get("X-Commission-History-Meta");
        const meta = metaRaw
          ? (JSON.parse(metaRaw) as {
              rowCount: number;
              agentCount: number;
              filename: string;
            })
          : null;

        const blob = await res.blob();
        const filename =
          meta?.filename ||
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ||
          "commission-history.xlsx";
        downloadBlob(filename, blob);

        setMessage(
          `Downloaded ${filename}${
            meta?.rowCount != null
              ? ` · ${meta.rowCount} client row${meta.rowCount === 1 ? "" : "s"}`
              : ""
          }.`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExportKind(null);
      }
    });
  };

  const exportAgentClientDetails = () => {
    setMessage(null);
    setError(null);
    setExportKind("details");
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/periods/${periodId}/agent-client-details`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentPeriodIds: [...selected] }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Export failed");
          return;
        }

        const metaRaw = res.headers.get("X-Agent-Client-Details-Meta");
        const meta = metaRaw
          ? (JSON.parse(metaRaw) as {
              agentCount: number;
              clientRowCount: number;
              chargebackRowCount: number;
              filename: string;
            })
          : null;

        const blob = await res.blob();
        const filename =
          meta?.filename ||
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ||
          "agent-client-details.xlsx";
        downloadBlob(filename, blob);

        const parts = [
          meta?.agentCount != null ? `${meta.agentCount} agents` : null,
          meta?.clientRowCount != null
            ? `${meta.clientRowCount} client row${meta.clientRowCount === 1 ? "" : "s"}`
            : null,
          meta?.chargebackRowCount
            ? `${meta.chargebackRowCount} chargeback${meta.chargebackRowCount === 1 ? "" : "s"}`
            : null,
        ].filter(Boolean);
        setMessage(
          `Downloaded ${filename}${parts.length ? ` · ${parts.join(", ")}` : ""}.`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExportKind(null);
      }
    });
  };

  return (
    <div className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Team commissions · view only · open an agent for file detail and claims"
            : "Select people to export · Gusto, Commission History, or Agent Client Details"}
        </p>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            {dismissedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowDismissed((v) => !v)}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {showDismissed ? "Hide dismissed" : `Dismissed (${dismissedCount})`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleAll}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
            <button
              type="button"
              disabled={!someSelected || pending}
              onClick={exportGusto}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              {pending && exportKind === "gusto"
                ? "Exporting…"
                : `Export Gusto${someSelected ? ` (${selected.size})` : ""}`}
            </button>
            <button
              type="button"
              disabled={!someSelected || pending}
              onClick={exportCommissionHistory}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {pending && exportKind === "history"
                ? "Exporting…"
                : `Commission History${someSelected ? ` (${selected.size})` : ""}`}
            </button>
            <button
              type="button"
              disabled={!someSelected || pending}
              onClick={exportAgentClientDetails}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {pending && exportKind === "details"
                ? "Exporting…"
                : `Agent Client Details${someSelected ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        ) : null}
      </div>

      {!readOnly && message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {!readOnly && error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="glass-panel overflow-hidden py-0">
        <div className="-mx-px overflow-x-auto overscroll-x-contain rounded-[inherit]">
        <table className="w-full min-w-[62rem] border-collapse text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              {!readOnly ? (
                <th className="px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all agents"
                    className="rounded border-border"
                  />
                </th>
              ) : null}
              <SortTh
                label="Agent"
                sortKey="agentName"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="min-w-[11rem]"
              />
              <SortTh
                label="Units"
                sortKey="unitsCleared"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Pending"
                sortKey="pendingUnits"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Next"
                sortKey="next"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Tier"
                sortKey="adjustedTier"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Rate"
                sortKey="tierRate"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Gross"
                sortKey="grossCommission"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Clawback"
                sortKey="clawbackAmount"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Net"
                sortKey="netCommission"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortTh
                label="Cancel"
                sortKey="cancellationRate"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <th className="px-3 py-2.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {visibleAgents.map((r) => {
              const toNext = unitsToNextTier(r.unitsCleared, r.agentName);
              const fixed = getFixedRate(r.agentName) !== null;
              const hot = toNext != null && toNext <= 3;
              const warm = toNext != null && toNext <= 10;
              const employment = resolveEmployment(r.agentName);
              const isContractor = employment.employmentType === "contractor";
              const companyTitle = employment.companyName
                ? `Contractor · ${employment.companyName}`
                : "Contractor";
              const checked = selected.has(r.id);

              return (
                <tr
                  key={r.id}
                  className={cn(
                    "hover:bg-muted/30",
                    !readOnly && checked && "bg-muted/40",
                    r.dismissed && "opacity-60",
                  )}
                >
                  {!readOnly ? (
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={Boolean(r.dismissed)}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.agentName}`}
                        className="rounded border-border"
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2 align-middle whitespace-nowrap">
                    <div className="flex max-w-[14rem] items-center gap-1.5">
                      {r.dismissed ? (
                        <span className="truncate font-medium" title={r.agentName}>
                          {r.agentName}
                        </span>
                      ) : (
                        <Link
                          href={`/portal/period/${periodId}/agent/${r.id}`}
                          className="truncate font-medium underline-offset-2 hover:underline"
                          title={`View files for ${r.agentName}`}
                        >
                          {r.agentName}
                        </Link>
                      )}
                      {isContractor ? (
                        <span
                          className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                          title={companyTitle}
                        >
                          1099
                        </span>
                      ) : null}
                      {r.dismissed ? (
                        <span className="shrink-0 text-[10px] font-medium tracking-wide text-destructive uppercase">
                          Dismissed
                        </span>
                      ) : null}
                    </div>
                    {isContractor && employment.companyName ? (
                      <p
                        className="max-w-[14rem] truncate text-[11px] leading-tight text-muted-foreground"
                        title={employment.companyName}
                      >
                        {employment.companyName}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {r.unitsCleared}
                  </td>
                  <td
                    className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums"
                    title="Pending cancellations"
                  >
                    {r.pendingUnits > 0 ? (
                      <span className="font-medium text-amber-800">{r.pendingUnits}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle">
                    {toNext == null ? (
                      <span className="text-muted-foreground">
                        {fixed ? "Fixed" : r.adjustedTier >= 6 ? "Top" : "—"}
                      </span>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "px-1.5 py-0 text-[11px] tabular-nums",
                          hot && "bg-amber-100 text-amber-900",
                          warm && !hot && "bg-amber-50 text-amber-800",
                        )}
                      >
                        {toNext}
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {r.cancellationPenaltyApplied
                      ? `${r.rawTier}→${r.adjustedTier}`
                      : r.adjustedTier || "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {ratePercent(r.tierRate)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {money(r.grossCommission)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {Number(r.clawbackAmount) > 0 ? (
                      <span className="text-destructive">-{money(r.clawbackAmount)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle font-semibold tabular-nums">
                    {money(r.netCommission)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums">
                    {cancelRatePercent(r.cancellationRate)}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <PeriodAgentRowActions
                      periodId={periodId}
                      agentPeriodId={r.id}
                      agentName={r.agentName}
                      dismissed={r.dismissed}
                      readOnly={readOnly}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
