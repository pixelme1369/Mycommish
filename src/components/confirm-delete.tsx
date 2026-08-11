"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDeleteProps = {
  title: string;
  description: string;
  triggerLabel?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Ghost/text style trigger (e.g. agent remove links). */
  triggerVariant?: "destructive" | "ghost" | "outline";
  triggerSize?: "default" | "sm" | "xs";
  triggerClassName?: string;
  disabled?: boolean;
  /** Controlled open — use when trigger lives in a menu that unmounts. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide built-in trigger (pair with controlled open). */
  hideTrigger?: boolean;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDelete({
  title,
  description,
  triggerLabel = "Delete",
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  triggerVariant = "destructive",
  triggerSize = "sm",
  triggerClassName,
  disabled,
  open: openProp,
  onOpenChange,
  hideTrigger,
  onConfirm,
}: ConfirmDeleteProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, start] = useTransition();
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (pending && !next) return;
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <AlertDialogTrigger
          disabled={disabled || pending}
          render={
            <Button
              variant={triggerVariant}
              size={triggerSize}
              className={triggerClassName}
              disabled={disabled || pending}
            />
          }
        >
          {pending ? pendingLabel : triggerLabel}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Delete failed.");
                }
              });
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
