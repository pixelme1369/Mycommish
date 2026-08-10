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
  triggerLabel: string;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Ghost/text style trigger (e.g. agent remove links). */
  triggerVariant?: "destructive" | "ghost" | "outline";
  triggerSize?: "default" | "sm" | "xs";
  triggerClassName?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDelete({
  title,
  description,
  triggerLabel,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  triggerVariant = "destructive",
  triggerSize = "sm",
  triggerClassName,
  disabled,
  onConfirm,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
      }}
    >
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
