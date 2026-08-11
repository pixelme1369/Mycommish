"use client";

import { useState, useTransition } from "react";
import { reviewFileClaimAction } from "@/app/portal/files/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClaimReviewForm({
  claimId,
  pending,
}: {
  claimId: string;
  pending: boolean;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!pending) return null;

  function review(decision: "accepted" | "rejected") {
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.set("claimId", claimId);
    fd.set("decision", decision);
    if (adminNote.trim()) fd.set("adminNote", adminNote.trim());
    start(async () => {
      const res = await reviewFileClaimAction(null, fd);
      if (!res) return;
      if (res.ok) setMessage(res.message);
      else setError(res.error);
    });
  }

  return (
    <div className="w-[11.5rem] space-y-1.5">
      <Input
        value={adminNote}
        onChange={(e) => setAdminNote(e.target.value)}
        placeholder="Admin notes"
        className="h-7 text-xs"
        disabled={busy}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 px-2 text-xs"
          disabled={busy}
          onClick={() => review("accepted")}
        >
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 flex-1 px-2 text-xs"
          disabled={busy}
          onClick={() => review("rejected")}
        >
          Reject
        </Button>
      </div>
      {error ? <p className="text-[11px] leading-snug text-destructive">{error}</p> : null}
      {message ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
