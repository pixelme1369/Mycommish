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

export function OpenerExportButton({ monthLabel }: { monthLabel: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending || !monthLabel}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              const res = await fetch(
                `/api/admin/openers/export?month=${encodeURIComponent(monthLabel)}`,
              );
              if (!res.ok) {
                const body = (await res.json().catch(() => null)) as {
                  error?: string;
                } | null;
                throw new Error(body?.error || "Export failed");
              }
              const blob = await res.blob();
              const match = /filename="([^"]+)"/.exec(
                res.headers.get("Content-Disposition") || "",
              );
              downloadBlob(match?.[1] || `opener-payout-${monthLabel}.xlsx`, blob);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export failed");
            }
          });
        }}
      >
        {pending ? "Downloading…" : "Download Excel"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
