"use client";

import { useActionState } from "react";
import {
  sendDocumentToAllAgentsAction,
  type SendDocumentResult,
} from "@/app/admin/document-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SentDoc = {
  id: string;
  title: string;
  filename: string;
  sentAt: string;
  recipientCount: number;
  signedCount: number;
};

export function AdminDocumentSend({
  recipientCount,
  recent,
}: {
  recipientCount: number;
  recent: SentDoc[];
}) {
  const [state, action, pending] = useActionState(
    sendDocumentToAllAgentsAction,
    null as SendDocumentResult | null,
  );

  return (
    <section>
      <div>
        <h2 className="font-heading text-base tracking-tight">Documents</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload a PDF and send it to every agent to sign
        </p>
      </div>
      <Card className="glass-panel mt-4 p-4 sm:p-5">
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              name="title"
              placeholder="e.g. September 2026 contractor agreement"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-file">PDF</Label>
            <input
              id="doc-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm file:mr-3 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending
                ? "Sending…"
                : `Send to ${recipientCount} agent${recipientCount === 1 ? "" : "s"}`}
            </Button>
            {state?.ok ? (
              <p className="text-sm text-emerald-700" role="status">
                {state.message}
              </p>
            ) : null}
            {state && !state.ok ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Agents see it under Signed documents as Pending until they sign. Signed
          copies stay on their tab for a few months.
        </p>
      </Card>

      {recent.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {recent.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-card/80 px-4 py-3 ring-1 ring-border/70"
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.filename}</p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {d.signedCount}/{d.recipientCount} signed
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
