"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminDocumentsMenu({ active }: { active?: boolean }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const menuWidth = 196;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 4;
      const measured = menuRef.current?.offsetHeight || 88;
      const openUp = rect.bottom + measured + gap > window.innerHeight - 8;
      const top = openUp
        ? Math.max(8, rect.top - measured - gap)
        : rect.bottom + gap;
      const left = Math.min(
        Math.max(8, rect.left),
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
            <Link
              role="menuitem"
              href="/admin/statements"
              className="block px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Signed commissions
            </Link>
            <Link
              role="menuitem"
              href="/admin/documents"
              className="block px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Uploaded documents
            </Link>
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
          buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
          "gap-1",
        )}
      >
        Documents
        <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {menu}
    </>
  );
}
