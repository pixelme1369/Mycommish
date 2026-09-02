"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mapForthAssignedToAction } from "@/app/admin/agents/actions";
import { sortUsersForForthName } from "@/lib/forth/unmatched-match";
import type { ForthMapUser, UnmatchedForthName } from "@/lib/forth/unmatched";

function optionLabel(user: ForthMapUser) {
  const aliasBit =
    user.aliases.length === 0 ? "no CRM alias" : user.aliases.join(", ");
  if (user.role === "opener") {
    return `${user.displayName} · opener · ${aliasBit}`;
  }
  return `${user.displayName} · ${aliasBit}`;
}

function UnmatchedRow({
  row,
  users,
  pending,
  onMap,
}: {
  row: UnmatchedForthName;
  users: ForthMapUser[];
  pending: boolean;
  onMap: (assignedTo: string, agentId: string) => void;
}) {
  const [agentId, setAgentId] = useState("");
  const grouped = useMemo(
    () => sortUsersForForthName(row.assignedTo, users),
    [row.assignedTo, users],
  );
  const alphabetical = useMemo(
    () => [...users].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users],
  );
  const openers = useMemo(
    () => alphabetical.filter((u) => u.role === "opener"),
    [alphabetical],
  );

  return (
    <li className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 sm:w-56 sm:shrink-0">
        <p className="truncate font-medium">{row.assignedTo}</p>
        <p className="text-[11px] text-muted-foreground">
          {row.fileCount} Forth file{row.fileCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={pending}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label={`Map ${row.assignedTo} to a user`}
        >
          <option value="">Choose user (ADP CRM aliases)…</option>
          {grouped.likely.length > 0 ? (
            <optgroup label="Likely match">
              {grouped.likely.map((u) => (
                <option key={`likely-${u.id}`} value={u.id}>
                  {optionLabel(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {openers.length > 0 ? (
            <optgroup label="Openers (no Goals)">
              {openers.map((u) => (
                <option key={`opener-${u.id}`} value={u.id}>
                  {optionLabel(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label={grouped.likely.length || openers.length ? "All users" : "Users"}>
            {alphabetical.map((u) => (
              <option key={u.id} value={u.id}>
                {optionLabel(u)}
              </option>
            ))}
          </optgroup>
        </select>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={pending || !agentId}
          onClick={() => onMap(row.assignedTo, agentId)}
        >
          Map
        </Button>
      </div>
    </li>
  );
}

export function UnmatchedForthPanel({
  rows,
  users,
}: {
  rows: UnmatchedForthName[];
  users: ForthMapUser[];
}) {
  const router = useRouter();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (rows.length === 0) return null;

  function onMap(assignedTo: string, agentId: string) {
    setError(null);
    setNote(null);
    setPendingName(assignedTo);
    start(async () => {
      const result = await mapForthAssignedToAction(assignedTo, agentId);
      setPendingName(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote(result.message);
      router.refresh();
    });
  }

  return (
    <Card id="forth-unmatched" className="glass-panel overflow-hidden py-0">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="font-heading text-base tracking-tight">
          Forth names not mapped
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          These Forth <span className="font-mono text-xs">assigned_to</span> names
          don’t match a login. Pick the user — ADP CRM aliases are in the list so
          you can tell them apart. Map openers too; they don’t have Goals, but
          Forth files still attach to their login.
        </p>
      </div>
      {error ? (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="px-4 py-2 text-sm text-emerald-700" role="status">
          {note}
        </p>
      ) : null}
      <ul>
        {rows.map((row) => (
          <UnmatchedRow
            key={row.assignedTo}
            row={row}
            users={users}
            pending={busy && pendingName === row.assignedTo}
            onMap={onMap}
          />
        ))}
      </ul>
    </Card>
  );
}
