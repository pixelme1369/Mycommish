"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  deleteAllCalculatedPeriodsAction,
  deleteAllHistoryPeriodsAction,
  deletePeriodsByFilenameAction,
} from "./actions";

type Kind = "calculated" | "history";

export function DeleteAllPeriodsButton({
  kind,
  count,
}: {
  kind: Kind;
  count: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const label = kind === "history" ? "history" : "calculated";

  return (
    <button
      type="button"
      disabled={pending || count === 0}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
      onClick={() => {
        if (
          !confirm(
            `Delete ALL ${count} ${label} period(s)? This removes every agent and client row they contain. You can re-upload afterward. This cannot be undone.`,
          )
        ) {
          return;
        }
        start(async () => {
          const res =
            kind === "history"
              ? await deleteAllHistoryPeriodsAction()
              : await deleteAllCalculatedPeriodsAction();
          if (!res.ok) {
            alert("Delete failed.");
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : `Delete all ${label} (${count})`}
    </button>
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
  const [pending, start] = useTransition();
  const label = kind === "history" ? "history" : "calculated";

  return (
    <button
      type="button"
      disabled={pending || !filename}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
      onClick={() => {
        if (
          !confirm(
            `Delete ${periodCount} ${label} period(s) from "${filename}"? This removes every agent and client record they contain. This cannot be undone.`,
          )
        ) {
          return;
        }
        start(async () => {
          const res = await deletePeriodsByFilenameAction(filename, kind);
          if (!res.ok) {
            alert(res.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : "Delete upload"}
    </button>
  );
}
