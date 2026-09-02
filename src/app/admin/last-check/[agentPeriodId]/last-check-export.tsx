"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LastCheckExportButtons({
  agentPeriodId,
  canGusto,
  lastPaysKey,
  canLastPays,
}: {
  agentPeriodId?: string | null;
  canGusto: boolean;
  lastPaysKey?: string | null;
  canLastPays?: boolean;
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"gusto" | "files" | "pays" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(next: "gusto" | "files" | "pays") {
    setError(null);
    setKind(next);
    start(async () => {
      try {
        const path =
          next === "pays"
            ? `/api/admin/dismissed/${encodeURIComponent(lastPaysKey || "")}/last-pays`
            : next === "gusto"
              ? `/api/admin/last-check/${agentPeriodId}/gusto`
              : `/api/admin/last-check/${agentPeriodId}/files`;
        const res = await fetch(path);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Export failed");
        }
        const blob = await res.blob();
        const disp = res.headers.get("Content-Disposition") || "";
        const match = /filename="([^"]+)"/.exec(disp);
        downloadBlob(match?.[1] || `last-check-${next}.xlsx`, blob);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setKind(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {lastPaysKey ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !canLastPays}
            onClick={() => run("pays")}
          >
            {kind === "pays" ? "Exporting…" : "Export already paid"}
          </Button>
        ) : null}
        {agentPeriodId ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run("files")}
            >
              {kind === "files" ? "Exporting…" : "Export files"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || !canGusto}
              onClick={() => run("gusto")}
            >
              {kind === "gusto" ? "Exporting…" : "Export Gusto"}
            </Button>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
