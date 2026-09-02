"use client";

import { useActionState, useEffect } from "react";
import { sendAgentDocumentAction } from "@/app/admin/document-actions";
import type { SendDocumentResult } from "@/app/admin/document-action-types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AgentDocumentForm({
  agentId,
  onCancel,
  onSuccess,
}: {
  agentId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(
    sendAgentDocumentAction,
    null as SendDocumentResult | null,
  );

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="audience" value="one" />
      <input type="hidden" name="agentId" value={agentId} />
      <div className="space-y-1.5">
        <Label htmlFor="one-doc-title">Title</Label>
        <Input id="one-doc-title" name="title" className="h-9" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="one-doc-file">PDF</Label>
        <input
          id="one-doc-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm file:mr-3 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="one-doc-intent">What to do</Label>
        <select
          id="one-doc-intent"
          name="intent"
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue="sign"
        >
          <option value="sign">Send to e-sign in the portal</option>
          <option value="file">File already-signed paper copy</option>
        </select>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} onClick={onCancel}>
          Cancel
        </AlertDialogCancel>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

export function AdminAgentDocumentDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Document for {agentName}</AlertDialogTitle>
          <AlertDialogDescription>
            Send a PDF for them to e-sign, or file a scan of a paper copy they already
            signed. Filed copies stay on their portal Signed documents tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {open && agentId ? (
          <AgentDocumentForm
            key={agentId}
            agentId={agentId}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => onOpenChange(false)}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
