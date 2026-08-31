"use client";

import { useActionState, useEffect, useState } from "react";
import { saveOwnPhoneAction, type SavePhoneResult } from "@/app/portal/phone-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DISMISS_KEY = "mycommish:phone-prompt-dismissed";

/**
 * Soft, dismissible phone prompt — never blocks the commissions viewport.
 * Hidden once saved, or when the agent taps “Not now” (persists in localStorage).
 */
export function AgentPhoneForm({
  currentPhone,
}: {
  currentPhone: string | null;
}) {
  const [state, action, pending] = useActionState(
    saveOwnPhoneAction,
    null as SavePhoneResult | null,
  );
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  // Saved in this session — clear dismiss flag so a future clear can re-prompt.
  useEffect(() => {
    if (state?.ok) {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [state]);

  if (currentPhone || state?.ok) return null;
  if (!ready || dismissed) return null;

  return (
    <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Add a mobile number</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional — used for commission and payout outreach.
        </p>
      </div>
      <form
        action={action}
        className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
      >
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(555) 123-4567"
          className="h-8 w-full sm:w-[11rem]"
          aria-label="Mobile number"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending} className="h-8">
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground"
            onClick={dismiss}
          >
            Not now
          </Button>
        </div>
      </form>
      {state?.ok === false ? (
        <p className="text-xs text-destructive sm:basis-full">{state.error}</p>
      ) : null}
    </div>
  );
}
