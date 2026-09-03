"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const USER_COLUMN_STORAGE_KEY = "mycommish:admin-users-columns";

export const USER_COLUMNS = [
  { id: "status", label: "Status", locked: false, defaultOn: true },
  { id: "name", label: "Name", locked: true, defaultOn: true },
  { id: "email", label: "Email", locked: false, defaultOn: true },
  { id: "role", label: "Role", locked: false, defaultOn: true },
  { id: "employment", label: "Employment", locked: false, defaultOn: true },
  { id: "phone", label: "Phone", locked: false, defaultOn: false },
  { id: "aliases", label: "Aliases", locked: false, defaultOn: true },
  { id: "lastLogin", label: "Last login", locked: false, defaultOn: true },
  { id: "login", label: "Login", locked: false, defaultOn: true },
] as const;

export type UserColumnId = (typeof USER_COLUMNS)[number]["id"];

export const DEFAULT_USER_COLUMNS: UserColumnId[] = USER_COLUMNS.filter(
  (c) => c.defaultOn,
).map((c) => c.id);

function parseSaved(raw: string | null): UserColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(USER_COLUMNS.map((c) => c.id));
    const ids = parsed.filter(
      (id): id is UserColumnId => typeof id === "string" && allowed.has(id as UserColumnId),
    );
    if (!ids.includes("name")) ids.unshift("name");
    return ids.length ? USER_COLUMNS.map((c) => c.id).filter((id) => ids.includes(id)) : null;
  } catch {
    return null;
  }
}

export function loadUserColumns(): UserColumnId[] {
  if (typeof window === "undefined") return DEFAULT_USER_COLUMNS;
  try {
    return parseSaved(localStorage.getItem(USER_COLUMN_STORAGE_KEY)) ?? DEFAULT_USER_COLUMNS;
  } catch {
    return DEFAULT_USER_COLUMNS;
  }
}

export function UsersColumnPicker({
  visible,
  onChange,
}: {
  visible: UserColumnId[];
  onChange: (next: UserColumnId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const menuWidth = 220;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 4;
      const measured = menuRef.current?.offsetHeight || 280;
      const openUp = rect.bottom + measured + gap > window.innerHeight - 8;
      const top = openUp
        ? Math.max(8, rect.top - measured - gap)
        : rect.bottom + gap;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setCoords({ top, left });
    };
    place();
    requestAnimationFrame(place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", () => setOpen(false), true);
    window.addEventListener("resize", () => setOpen(false));
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: UserColumnId, locked: boolean) {
    if (locked) return;
    if (visible.includes(id)) {
      onChange(visible.filter((c) => c !== id));
    } else {
      onChange(USER_COLUMNS.map((c) => c.id).filter((c) => c === id || visible.includes(c)));
    }
  }

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Columns"
            style={{ top: coords.top, left: coords.left, width: menuWidth }}
            className="fixed z-[100] rounded-md border border-border bg-background p-2 shadow-lg"
          >
            <p className="px-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Columns
            </p>
            <ul className="space-y-0.5">
              {USER_COLUMNS.map((col) => {
                const checked = visible.includes(col.id);
                return (
                  <li key={col.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted",
                        col.locked && "cursor-default opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={checked}
                        disabled={col.locked}
                        onChange={() => toggle(col.id, col.locked)}
                      />
                      <span>{col.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="mt-1.5 w-full rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onChange([...DEFAULT_USER_COLUMNS])}
            >
              Reset to default
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-1">
      <span className="block text-[11px] text-muted-foreground">Columns</span>
      <button
        ref={buttonRef}
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-9 gap-1.5")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Columns3 className="size-3.5" />
        Columns
      </button>
      {menu}
    </div>
  );
}
