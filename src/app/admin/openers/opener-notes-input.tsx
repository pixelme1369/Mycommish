"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import type { OpenerLogActionResult } from "@/lib/opener/action-types";

export function OpenerNotesInput({
  logId,
  notes,
  action,
}: {
  logId: string;
  notes: string;
  action: (
    prev: OpenerLogActionResult | null,
    formData: FormData,
  ) => Promise<OpenerLogActionResult>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    null as OpenerLogActionResult | null,
  );

  return (
    <form
      action={formAction}
      onBlur={(e) => {
        const form = e.currentTarget;
        const next = String(new FormData(form).get("notes") || "");
        if (next.trim() !== notes.trim()) form.requestSubmit();
      }}
    >
      <input type="hidden" name="id" value={logId} />
      <Input
        name="notes"
        defaultValue={notes}
        disabled={pending}
        placeholder="Notes"
        aria-label="Notes"
        className="h-8 min-w-[8rem]"
      />
      {state?.ok === false ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
