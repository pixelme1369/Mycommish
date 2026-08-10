"use client";

import { useRouter } from "next/navigation";
import {
  deleteAllCalculatedPeriodsAction,
  deleteAllHistoryPeriodsAction,
  deletePeriodsByFilenameAction,
} from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";

type Kind = "calculated" | "history";

export function DeleteAllPeriodsButton({
  kind,
  count,
}: {
  kind: Kind;
  count: number;
}) {
  const router = useRouter();
  const label = kind === "history" ? "history" : "calculated";

  return (
    <ConfirmDelete
      title={`Delete all ${label} periods?`}
      description={`This permanently deletes ALL ${count} ${label} period(s) and every agent/client/ledger row they contain. You can re-upload afterward. This cannot be undone.`}
      triggerLabel={`Delete all ${label} (${count})`}
      confirmLabel={`Yes, delete all ${count}`}
      disabled={count === 0}
      onConfirm={async () => {
        const res =
          kind === "history"
            ? await deleteAllHistoryPeriodsAction()
            : await deleteAllCalculatedPeriodsAction();
        if (!res.ok) throw new Error("Delete failed.");
        router.refresh();
      }}
    />
  );
}

export function DeleteUploadByFilenameButton({
  filename,
  kind,
  periodCount,
}: {
  filename: string;
  kind: Kind;
  periodCount: number;
}) {
  const router = useRouter();
  const label = kind === "history" ? "history" : "calculated";

  return (
    <ConfirmDelete
      title={`Delete upload “${filename}”?`}
      description={`This permanently deletes ${periodCount} ${label} period(s) from “${filename}” and every agent/client record they contain. This cannot be undone.`}
      triggerLabel="Delete upload"
      confirmLabel="Yes, delete upload"
      disabled={!filename}
      onConfirm={async () => {
        const res = await deletePeriodsByFilenameAction(filename, kind);
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      }}
    />
  );
}
