"use client";

import { useActionState } from "react";
import { createFileClaimAction, type ClaimActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const initial: ClaimActionState = null;

export function MissingFileClaimForm() {
  const [state, action, pending] = useActionState(createFileClaimAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="crmId">External ID</Label>
          <Input
            id="crmId"
            name="crmId"
            required
            placeholder="e.g. 1236336834"
          />
          <p className="text-xs text-muted-foreground">
            ADP CRM External ID (same value as Cordoba ID). Not the CRM ID column.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientName">Name</Label>
          <Input id="clientName" name="clientName" required placeholder="Client full name" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="Why you think it’s missing" />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      {state?.ok === false ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t submit</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === true ? (
        <Alert>
          <AlertTitle>Sent</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

