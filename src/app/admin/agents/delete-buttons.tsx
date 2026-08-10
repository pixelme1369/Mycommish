"use client";

import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteAgentAction, deleteAliasAction } from "./actions";

export function DeleteAgentButton({
  agentId,
  displayName,
}: {
  agentId: string;
  displayName: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Delete login for ${displayName}?`}
      description={`This removes the login account and all CRM name aliases for ${displayName}. Commission history in the ledger is not deleted. This cannot be undone.`}
      triggerLabel="Delete login"
      confirmLabel="Yes, delete login"
      triggerVariant="ghost"
      triggerClassName="text-destructive hover:text-destructive"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("agentId", agentId);
        await deleteAgentAction(fd);
        router.refresh();
      }}
    />
  );
}

export function DeleteAliasButton({
  aliasId,
  agentName,
}: {
  aliasId: string;
  agentName: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDelete
      title={`Remove alias “${agentName}”?`}
      description={`This unmaps the CRM Sales Rep spelling “${agentName}” from this login. Portal rows for that name will no longer show for this user.`}
      triggerLabel="Remove"
      confirmLabel="Yes, remove alias"
      triggerVariant="ghost"
      triggerSize="xs"
      triggerClassName="text-muted-foreground"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("aliasId", aliasId);
        await deleteAliasAction(fd);
        router.refresh();
      }}
    />
  );
}
