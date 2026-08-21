"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addAliasAction, type AddAliasResult } from "./actions";

const initial: AddAliasResult | null = null;

export function AliasAutocomplete({
  agentId,
  suggestions,
  excludeNames = [],
}: {
  agentId: string;
  suggestions: string[];
  /** Already mapped aliases for this login (hide from list). */
  excludeNames?: string[];
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [state, action, pending] = useActionState(addAliasAction, initial);
  const listRef = useRef<HTMLUListElement>(null);

  const excluded = useMemo(
    () => new Set(excludeNames.map((n) => n.trim().toLowerCase())),
    [excludeNames],
  );

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = suggestions.filter((n) => !excluded.has(n.toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [suggestions, excluded, value]);

  useEffect(() => {
    if (state?.ok) {
      setValue("");
      setOpen(false);
    }
  }, [state]);

  function pick(name: string) {
    setValue(name);
    setOpen(false);
  }

  return (
    <div className="mt-3 space-y-2">
      <form action={action} className="relative flex gap-2">
        <input type="hidden" name="agentId" value={agentId} />
        <div className="relative min-w-0 flex-1">
          <input
            name="agentName"
            type="text"
            required
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={(e) => {
              if (!open || matches.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && matches[highlight]) {
                e.preventDefault();
                pick(matches[highlight]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type Sales Rep name… e.g. alex"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            disabled={pending}
          />
          {open && matches.length > 0 ? (
            <ul
              ref={listRef}
              className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
              role="listbox"
            >
              <li className="px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
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
                        ? "block w-full bg-zinc-100 px-3 py-1.5 text-left text-sm"
                        : "block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(name)}
                  >
                    {highlightMatch(name, value)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {open && value.trim() && matches.length === 0 ? (
            <p className="absolute z-40 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-md">
              No match in uploaded CRM — you can still submit the exact spelling.
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add alias"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function highlightMatch(name: string, query: string) {
  const q = query.trim();
  if (!q) return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="font-semibold text-zinc-900">{name.slice(idx, idx + q.length)}</span>
      {name.slice(idx + q.length)}
    </>
  );
}
