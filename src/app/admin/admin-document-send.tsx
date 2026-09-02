"use client";

import { useActionState, useState } from "react";
import type { SendDocumentResult } from "@/app/admin/document-action-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AgentOpt = { id: string; displayName: string; email: string };

type SendAction = (
  prev: SendDocumentResult | null,
  formData: FormData,
) => Promise<SendDocumentResult>;

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function AdminDocumentSend({
  sendAction,
  recipientCount,
  agents,
  defaultAgentId,
}: {
  sendAction: SendAction;
  recipientCount: number;
  agents: AgentOpt[];
  defaultAgentId?: string;
}) {
  const [state, action, pending] = useActionState(
    sendAction,
    null as SendDocumentResult | null,
  );
  const [audience, setAudience] = useState<"all" | "one">(
    defaultAgentId ? "one" : "all",
  );
  const [intent, setIntent] = useState<"sign" | "file">("sign");

  return (
    <section>
      <div>
        <h2 className="font-heading text-base tracking-tight">Send or file</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          E-sign in the portal, or keep a paper copy on one agent’s record
        </p>
      </div>
      <Card className="glass-panel mt-4 p-5 sm:p-6">
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-1.5">
              <Label htmlFor="doc-audience">Who</Label>
              <select
                id="doc-audience"
                name="audience"
                className={selectClass}
                value={audience}
                onChange={(e) => {
                  const next = e.target.value === "one" ? "one" : "all";
                  setAudience(next);
                  if (next === "all") setIntent("sign");
                }}
              >
                <option value="all">All agents ({recipientCount})</option>
                <option value="one">One agent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-intent">What to do</Label>
              <select
                id="doc-intent"
                name="intent"
                className={selectClass}
                value={intent}
                onChange={(e) => setIntent(e.target.value === "file" ? "file" : "sign")}
              >
                <option value="sign">Send to e-sign in the portal</option>
                <option value="file" disabled={audience === "all"}>
                  File already-signed paper copy
                </option>
              </select>
            </div>
          </div>
          {audience === "one" ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-agent">Agent</Label>
              <select
                id="doc-agent"
                name="agentId"
                defaultValue={defaultAgentId || ""}
                className={selectClass}
                required
              >
                <option value="">Select…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} · {a.email}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="agentId" value="" />
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending
                ? "Saving…"
                : intent === "file"
                  ? "File on their record"
                  : audience === "one"
                    ? "Send to this agent"
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
      </Card>
    </section>
  );
}
