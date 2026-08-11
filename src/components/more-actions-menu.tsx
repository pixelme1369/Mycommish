"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ⋯ menu that portals to document.body with fixed positioning so it is never
 * clipped by overflow-hidden cards / scroll containers.
 */
export function MoreActionsMenu({
  label = "More actions",
  children,
  menuWidth = 168,
  estimatedHeight = 120,
  align = "end",
}: {
  label?: string;
  children: (close: () => void) => ReactNode;
  menuWidth?: number;
  estimatedHeight?: number;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const place = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 4;
      const measured = menuRef.current?.offsetHeight || estimatedHeight;
      const openUp = rect.bottom + measured + gap > window.innerHeight - 8;
      const top = openUp
        ? Math.max(8, rect.top - measured - gap)
        : rect.bottom + gap;
      const rawLeft =
        align === "end" ? rect.right - menuWidth : rect.left;
      const left = Math.min(
        Math.max(8, rawLeft),
        window.innerWidth - menuWidth - 8,
      );
      setCoords({ top, left });
    };

    place();
    // Re-measure after paint once menu height is known
    requestAnimationFrame(place);
  }, [open, menuWidth, estimatedHeight, align]);

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
    const onDismiss = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [open]);

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{ top: coords.top, left: coords.left, width: menuWidth }}
            className="fixed z-[100] rounded-md border border-border bg-background py-1 shadow-lg"
          >
            {children(close)}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-7 w-7 px-0 text-muted-foreground",
        )}
        title={label}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">{label}</span>
      </button>
      {menu}
    </>
  );
}

export function menuItemClass(destructive?: boolean) {
  return cn(
    "block w-full px-3 py-1.5 text-left text-sm hover:bg-muted",
    destructive && "text-destructive",
  );
}
