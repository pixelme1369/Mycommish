"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  resetStatementSignaturesAction,
  signStatementAsAgentAction,
  signStatementAsManagerAction,
} from "./statement-actions";

type Role = "agent" | "manager";

export function StatementSignPanel({
  periodId,
  agentPeriodId,
  role,
  defaultName,
  status,
  agentSignedAt,
  agentTypedName,
  managerSignedAt,
  managerTypedName,
  canReset,
  className,
}: {
  periodId: string;
  agentPeriodId: string;
  role: Role;
  defaultName: string;
  status: "unsigned" | "agent_signed" | "fully_signed";
  agentSignedAt: string | null;
  agentTypedName: string | null;
  managerSignedAt: string | null;
  managerTypedName: string | null;
  canReset: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  const canAgentSign = role === "agent" && status === "unsigned";
  const canManagerSign = role === "manager" && status === "agent_signed";
  const canSign = canAgentSign || canManagerSign;
  const showReset = canReset && status !== "unsigned";

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasStroke.current = false;
  }, [open]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasStroke.current = true;
  }

  function onPointerUp() {
    drawing.current = false;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    hasStroke.current = false;
  }

  function submit() {
    setError(null);
    start(async () => {
      const canvas = canvasRef.current;
      const signatureDataUrl =
        canvas && hasStroke.current ? canvas.toDataURL("image/png") : null;
      const action =
        role === "agent" ? signStatementAsAgentAction : signStatementAsManagerAction;
      const res = await action({
        periodId,
        agentPeriodId,
        typedName,
        signatureDataUrl,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function reset() {
    if (
      !window.confirm(
        "Reset this statement’s signatures? The agent will need to sign again.",
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await resetStatementSignaturesAction({ periodId, agentPeriodId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const statusLabel =
    status === "fully_signed"
      ? "Fully signed"
      : status === "agent_signed"
        ? "Awaiting manager signature"
        : "Not signed yet";

  return (
    <div className={cn("rounded-xl ring-1 ring-border/70 bg-background p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Commission statement
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{statusLabel}</p>
          {agentSignedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Agent: {agentTypedName || "—"} ·{" "}
              {new Date(agentSignedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {managerSignedAt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manager: {managerTypedName || "—"} ·{" "}
              {new Date(managerSignedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/portal/periods/${periodId}/agents/${agentPeriodId}/statement`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted",
            )}
          >
            Download PDF
          </a>
          {canSign ? (
            <Button type="button" size="sm" className="h-8" onClick={() => setOpen(true)}>
              {role === "agent" ? "Sign statement" : "Countersign"}
            </Button>
          ) : null}
          {showReset ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pending}
              onClick={reset}
            >
              {pending ? "Resetting…" : "Reset signatures"}
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
          >
            <h2 className="font-heading text-lg tracking-tight">
              {role === "agent" ? "Sign your commission statement" : "Manager countersignature"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Type your name and optionally draw a signature. A timestamp is stored with the PDF.
            </p>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="sig-name">Full name</Label>
              <Input
                id="sig-name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name"
                className="h-9"
              />
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Draw signature (optional)</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearPad}
                >
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="h-28 w-full touch-none rounded-lg border border-border bg-white"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={submit}>
                {pending ? "Signing…" : "Confirm signature"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
