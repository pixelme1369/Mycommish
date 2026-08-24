"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Allura, Dancing_Script, Great_Vibes, Satisfy } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  resetStatementSignaturesAction,
  signStatementAsAgentAction,
  signStatementAsManagerAction,
} from "./statement-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { canAgentSignStatementForPeriod } from "@/lib/commission/calculator";

const fontVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });
const fontDance = Dancing_Script({ weight: "500", subsets: ["latin"] });
const fontAllura = Allura({ weight: "400", subsets: ["latin"] });
const fontSatisfy = Satisfy({ weight: "400", subsets: ["latin"] });

const SIGNATURE_STYLES = [
  { id: "vibes", label: "Style 1", className: fontVibes.className, family: fontVibes.style.fontFamily, size: 44 },
  { id: "dance", label: "Style 2", className: fontDance.className, family: fontDance.style.fontFamily, size: 36 },
  { id: "allura", label: "Style 3", className: fontAllura.className, family: fontAllura.style.fontFamily, size: 42 },
  { id: "satisfy", label: "Style 4", className: fontSatisfy.className, family: fontSatisfy.style.fontFamily, size: 36 },
] as const;

type SignMode = "style" | "draw";
type Role = "agent" | "manager";

async function renderTypedSignaturePng(
  name: string,
  family: string,
  size: number,
): Promise<string | null> {
  const text = name.trim();
  if (!text) return null;
  try {
    await document.fonts.load(`${size}px ${family}`);
  } catch {
    // continue with fallback metrics
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${size}px ${family}`;
  const metrics = ctx.measureText(text);
  const padX = 16;
  const padY = 12;
  const width = Math.ceil(metrics.width + padX * 2);
  const height = Math.ceil(size * 1.6 + padY * 2);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111827";
  ctx.font = `${size}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, height / 2);
  return canvas.toDataURL("image/png");
}

export function StatementSignPanel({
  periodId,
  agentPeriodId,
  periodLabel,
  role,
  lockedName,
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
  periodLabel: string;
  role: Role;
  /** Account display name — not editable; stamped on the PDF. */
  lockedName: string;
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
  const [tooEarlyOpen, setTooEarlyOpen] = useState(false);
  const [mode, setMode] = useState<SignMode>("style");
  const [selectedStyle, setSelectedStyle] = useState<string>(SIGNATURE_STYLES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  const canAgentSign = role === "agent" && status === "unsigned";
  const canManagerSign = role === "manager" && status === "agent_signed";
  const canSign = canAgentSign || canManagerSign;
  const showReset = canReset && status !== "unsigned";
  const signerName = lockedName.trim();
  const previewName = signerName || "Your name";
  const agentSignWindowOpen = canAgentSignStatementForPeriod(periodLabel);

  function onSignClick() {
    if (role === "agent" && !agentSignWindowOpen) {
      setTooEarlyOpen(true);
      return;
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open || mode !== "draw") return;
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
  }, [open, mode]);

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
      if (signerName.length < 2) {
        setError("Your account needs a full name before you can sign.");
        return;
      }

      let signatureDataUrl: string | null = null;
      if (mode === "draw") {
        const canvas = canvasRef.current;
        signatureDataUrl =
          canvas && hasStroke.current ? canvas.toDataURL("image/png") : null;
        if (!signatureDataUrl) {
          setError("Draw your signature, or switch to Choose style.");
          return;
        }
      } else {
        const style = SIGNATURE_STYLES.find((s) => s.id === selectedStyle);
        if (!style) {
          setError("Pick a signature style.");
          return;
        }
        signatureDataUrl = await renderTypedSignaturePng(
          signerName,
          style.family,
          style.size,
        );
        if (!signatureDataUrl) {
          setError("Could not create that signature style. Try another or draw.");
          return;
        }
      }

      const action =
        role === "agent" ? signStatementAsAgentAction : signStatementAsManagerAction;
      const res = await action({
        periodId,
        agentPeriodId,
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
          {error && !open ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/portal/periods/${periodId}/agents/${agentPeriodId}/statement?inline=1`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted",
            )}
          >
            View
          </a>
          <a
            href={`/api/portal/periods/${periodId}/agents/${agentPeriodId}/statement`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted",
            )}
          >
            Download PDF
          </a>
          {canSign ? (
            <Button type="button" size="sm" className="h-8" onClick={onSignClick}>
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
          >
            <h2 className="font-heading text-lg tracking-tight">
              {role === "agent" ? "Sign your commission statement" : "Manager countersignature"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account name is locked for this signature. Choose a style or draw.
            </p>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="sig-name">Full name</Label>
              <Input
                id="sig-name"
                value={signerName}
                readOnly
                className="h-9 bg-muted/40 text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Locked to the name on your login account.
              </p>
            </div>

            <div className="mt-4 flex gap-1 rounded-lg bg-muted/50 p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                  mode === "style" ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => setMode("style")}
              >
                Choose style
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                  mode === "draw" ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => setMode("draw")}
              >
                Draw
              </button>
            </div>

            {mode === "style" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Click the signature you want to use</p>
                <div className="grid gap-2">
                  {SIGNATURE_STYLES.map((style) => {
                    const selected = selectedStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedStyle(style.id)}
                        className={cn(
                          "rounded-lg border bg-white px-3 py-3 text-left transition-colors",
                          selected
                            ? "border-primary ring-2 ring-primary/25"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                          {style.label}
                        </span>
                        <p
                          className={cn(
                            "mt-1 truncate text-[1.65rem] leading-tight text-foreground",
                            style.className,
                          )}
                        >
                          {previewName}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Draw signature</Label>
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
            )}

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={submit}>
                {pending ? "Signing…" : "Adopt & sign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={tooEarlyOpen} onOpenChange={setTooEarlyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Too early to sign</AlertDialogTitle>
            <AlertDialogDescription>
              Too early to sign for this commission period. Signing opens one week before
              payday.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTooEarlyOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
