"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type NoteGroup = {
  key: string;
  title: string;
  count: number;
  rowNumbers: number[];
  extras: string[];
};

/** Collapse noisy "Row N: same message" lists into one professional summary line. */
export function groupUploadNotes(messages: string[]): NoteGroup[] {
  const map = new Map<string, NoteGroup>();

  for (const raw of messages) {
    const msg = String(raw || "").trim();
    if (!msg) continue;

    const rowMatch = msg.match(/^Row\s+(\d+)\s*:\s*(.+)$/i);
    if (rowMatch) {
      const row = Number(rowMatch[1]);
      const body = rowMatch[2].trim();
      const key = body.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (Number.isFinite(row)) existing.rowNumbers.push(row);
      } else {
        map.set(key, {
          key,
          title: body.replace(/\s*,\s*skipped$/i, "").replace(/\.$/, ""),
          count: 1,
          rowNumbers: Number.isFinite(row) ? [row] : [],
          extras: [],
        });
      }
      continue;
    }

    const key = msg.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.extras.push(msg);
    } else {
      map.set(key, {
        key,
        title: msg,
        count: 1,
        rowNumbers: [],
        extras: [],
      });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

function formatPeriodList(items: string[]): string {
  if (!items.length) return "none";
  if (items.length <= 6) return items.join(", ");
  return `${items.slice(0, 4).join(", ")} · +${items.length - 4} more`;
}

export function UploadResultCard({
  title,
  batchId,
  rows,
  notes,
  children,
}: {
  title: string;
  batchId?: string;
  rows?: Array<{ label: string; items: string[] } | { label: string; value: string }>;
  notes?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 px-4 py-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{title}</p>
        {batchId ? (
          <p className="font-mono text-[11px] text-muted-foreground">Batch {batchId}</p>
        ) : null}
      </div>

      {rows && rows.length > 0 ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => {
            const value =
              "value" in row
                ? row.value
                : formatPeriodList(row.items);
            return (
              <div key={row.label} className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  {row.label}
                </dt>
                <dd className="mt-0.5 truncate font-medium text-foreground" title={value}>
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {children}

      {notes && notes.length > 0 ? <UploadNotesPanel notes={notes} /> : null}
    </div>
  );
}

export function UploadNotesPanel({ notes }: { notes: string[] }) {
  const groups = useMemo(() => groupUploadNotes(notes), [notes]);
  const total = notes.length;
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Notes</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
          {total}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {groups.map((g) => {
          const open = openKey === g.key;
          const hasDetail = g.rowNumbers.length > 0 || g.extras.length > 0;
          return (
            <li
              key={g.key}
              className={cn(
                "rounded-md border border-border/70 bg-muted/20 px-3 py-2",
                open && "bg-muted/40",
              )}
            >
              <button
                type="button"
                disabled={!hasDetail}
                onClick={() => setOpenKey(open ? null : g.key)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 text-left",
                  hasDetail && "cursor-pointer",
                  !hasDetail && "cursor-default",
                )}
              >
                <span className="text-sm text-foreground">
                  {g.title}
                  {g.count > 1 ? (
                    <span className="text-muted-foreground"> · {g.count} rows</span>
                  ) : null}
                </span>
                {hasDetail ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {open ? "Hide" : "Details"}
                  </span>
                ) : null}
              </button>
              {open && hasDetail ? (
                <p className="mt-2 max-h-28 overflow-y-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {g.rowNumbers.length > 0
                    ? `Rows ${g.rowNumbers.slice(0, 40).join(", ")}${
                        g.rowNumbers.length > 40 ? ` · +${g.rowNumbers.length - 40} more` : ""
                      }`
                    : g.extras.slice(0, 8).join(" · ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
