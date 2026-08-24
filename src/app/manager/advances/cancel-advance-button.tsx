"use client";

import { useTransition } from "react";
import { cancelAdvanceAction } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CancelAdvanceButton({ advanceId }: { advanceId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-destructive")}
      onClick={() => {
        if (!window.confirm("Cancel this advance and reverse it from net?")) return;
        start(async () => {
          const res = await cancelAdvanceAction(advanceId);
          if (!res.ok) window.alert(res.error);
        });
      }}
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
