"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAgentAction, type CreateAgentResult } from "./actions";

const initial: CreateAgentResult | null = null;

export function AddUserPanel({ salesReps = [] }: { salesReps?: string[] }) {
  const [open, setOpen] = useState(false);
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [aliasOpen, setAliasOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [state, action, pending] = useActionState(createAgentAction, initial);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const excluded = useMemo(
    () => new Set(aliases.map((n) => n.trim().toLowerCase())),
    [aliases],
  );

  const matches = useMemo(() => {
    const q = aliasDraft.trim().toLowerCase();
    const pool = salesReps.filter((n) => !excluded.has(n.toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [salesReps, excluded, aliasDraft]);

  useEffect(() => {
    if (state?.ok) {
      setSuccessMessage(state.message);
      setOpen(false);
      setAliases([]);
      setAliasDraft("");
      setAliasOpen(false);
    }
  }, [state]);

  function addAlias(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (excluded.has(name.toLowerCase())) {
      setAliasDraft("");
      setAliasOpen(false);
      return;
    }
    setAliases((prev) => [...prev, name]);
    setAliasDraft("");
    setAliasOpen(false);
    setHighlight(0);
  }

  function removeAlias(name: string) {
    setAliases((prev) => prev.filter((a) => a !== name));
  }

  function closePanel() {
    setOpen(false);
    setAliases([]);
    setAliasDraft("");
    setAliasOpen(false);
  }

  if (!open) {
    return (
      <div className="flex max-w-xl flex-col items-end gap-2">
        {successMessage ? (
          <p className="w-full text-left text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {successMessage}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSuccessMessage(null);
            setOpen(true);
          }}
        >
          + Add user
        </Button>
      </div>
    );
  }

  return (
    <Card className="glass-panel w-full max-w-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Add user</h2>
        <Button type="button" size="sm" variant="ghost" onClick={closePanel}>
          Cancel
        </Button>
      </div>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" name="email" type="email" required placeholder="email@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Display name</Label>
          <Input id="new-name" name="displayName" required placeholder="Display name" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-role">Role</Label>
          <select
            id="new-role"
            name="role"
            defaultValue="agent"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="agent">Agent</option>
            <option value="opener">Opener</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Openers are not included in agent commission — their pay is calculated separately.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-password">Password (optional)</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            minLength={6}
            placeholder="Min 6 characters — leave blank for Google-only"
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="isContractor" type="checkbox" className="rounded border-input" />
          1099 contractor
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-company">Company (contractors)</Label>
          <Input id="new-company" name="companyName" placeholder="Legal entity name" />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-alias">CRM aliases (Sales Rep names)</Label>
          <p className="text-[11px] text-muted-foreground">
            Exact CRM Sales Rep spelling links this login to commission already in the system —
            no CRM re-upload needed. Display name is auto-added when it matches a known Sales Rep.
          </p>
          {aliases.map((name) => (
            <input key={name} type="hidden" name="alias" value={name} />
          ))}
          {aliases.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {aliases.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${name}`}
                    onClick={() => removeAlias(name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="relative flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                id="new-alias"
                type="text"
                autoComplete="off"
                value={aliasDraft}
                onChange={(e) => {
                  setAliasDraft(e.target.value);
                  setAliasOpen(true);
                  setHighlight(0);
                }}
                onFocus={() => setAliasOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setAliasOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (aliasOpen && matches[highlight]) addAlias(matches[highlight]);
                    else addAlias(aliasDraft);
                    return;
                  }
                  if (!aliasOpen || matches.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, matches.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Escape") {
                    setAliasOpen(false);
                  }
                }}
                placeholder="Type Sales Rep name… e.g. Tyler"
                className="h-9"
              />
              {aliasOpen && matches.length > 0 ? (
                <ul
                  className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-lg"
                  role="listbox"
                >
                  <li className="px-3 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Sales Rep matches
                  </li>
                  {matches.map((name, i) => (
                    <li key={name}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        className={
                          i === highlight
                            ? "block w-full bg-muted px-3 py-1.5 text-left text-sm"
                            : "block w-full px-3 py-1.5 text-left text-sm hover:bg-muted/60"
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addAlias(name)}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {aliasOpen && aliasDraft.trim() && matches.length === 0 ? (
                <p className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md">
                  No match in uploaded CRM — Add will use the exact spelling.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              onClick={() => addAlias(aliasDraft)}
            >
              Add alias
            </Button>
          </div>
        </div>

        {state && !state.ok ? (
          <p className="sm:col-span-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="sm"
          className="sm:col-span-2 sm:justify-self-end"
          disabled={pending}
        >
          {pending ? "Creating…" : "Create"}
        </Button>
      </form>
    </Card>
  );
}
