"use client";

import { useRouter } from "next/navigation";
import { deleteAllFileClaimsAction } from "@/app/portal/files/actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export function ClearAllClaimsButton({ claimCount }: { claimCount: number }) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title="Delete all file claims?"
      description={`This permanently removes ${claimCount} claim${claimCount === 1 ? "" : "s"} from the admin queue and every agent’s My claims. CRM files and assignments are unchanged. This cannot be undone.`}
      triggerLabel="Clear all claims"
      confirmLabel="Yes, delete all claims"
      triggerVariant="outline"
      triggerSize="sm"
      triggerClassName="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={claimCount === 0}
      onConfirm={async () => {
        const res = await deleteAllFileClaimsAction();
        if (!res?.ok) throw new Error(res?.error || "Failed to delete claims.");
        router.refresh();
      }}
    />
  );
}
