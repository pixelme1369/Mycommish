"use client";

import { useActionState } from "react";
import { saveOwnPhoneAction, type SavePhoneResult } from "@/app/portal/phone-actions";
import { formatPhoneForDisplay } from "@/lib/agents/phone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AgentPhoneForm({
  currentPhone,
  required,
}: {
  currentPhone: string | null;
  /** When true, show as a required setup card (missing phone). */
  required?: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveOwnPhoneAction,
    null as SavePhoneResult | null,
  );

  const displayDefault = formatPhoneForDisplay(currentPhone);

  return (
    <Card
      className={
        required
          ? "glass-panel mt-6 border-primary/30 p-5 ring-1 ring-primary/20"
          : "glass-panel mt-6 p-5"
      }
    >
      <h2 className="font-heading text-base tracking-tight">
        {required ? "Add your mobile number" : "Mobile number"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {required
          ? "We use this to reach you about commissions and payouts. Saved on your agent profile."
          : "Update anytime. Saved on your agent profile."}
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="agent-phone">Mobile</Label>
          <Input
            id="agent-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={Boolean(required)}
            defaultValue={displayDefault}
            placeholder="(555) 123-4567"
            className="h-10"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-10 shrink-0">
          {pending ? "Saving…" : currentPhone ? "Update phone" : "Save phone"}
        </Button>
      </form>
      {state?.ok === false ? (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok === true ? (
        <p className="mt-2 text-sm text-money">Saved {formatPhoneForDisplay(state.phone)}.</p>
      ) : null}
    </Card>
  );
}
