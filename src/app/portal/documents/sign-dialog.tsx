"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Allura, Dancing_Script, Great_Vibes, Satisfy } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signCompanyDocumentAction } from "@/app/portal/documents/actions";

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
    // fallback metrics
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

export function CompanyDocSignDialog({
  signatureId,
  title,
  lockedName,
  open,
  onClose,
}: {
  signatureId: string;
  title: string;
  lockedName: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<SignMode>("style");
  const [selectedStyle, setSelectedStyle] = useState<string>(SIGNATURE_STYLES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const signerName = lockedName.trim();
  const previewName = signerName || "Your name";

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

  if (!open) return null;

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
          setError("Could not create that signature style. Try draw.");
          return;
        }
      }
      const res = await signCompanyDocumentAction({
        signatureId,
        signatureDataUrl,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-4 shadow-lg ring-1 ring-border"
      >
        <h2 className="font-heading text-lg tracking-tight">Sign {title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account name is locked for this signature.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="doc-sig-name">Full name</Label>
          <Input
            id="doc-sig-name"
            value={signerName}
            readOnly
            className="h-9 bg-muted/40"
          />
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
          <div className="mt-3 grid gap-2">
            {SIGNATURE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setSelectedStyle(style.id)}
                className={cn(
                  "rounded-lg border bg-white px-3 py-3 text-left",
                  selectedStyle === style.id
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border",
                )}
              >
                <p className={cn("truncate text-[1.65rem] leading-tight", style.className)}>
                  {previewName}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="mt-3 h-28 w-full touch-none rounded-lg border border-border bg-white"
            onPointerDown={(e) => {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext("2d");
              if (!canvas || !ctx) return;
              canvas.setPointerCapture(e.pointerId);
              drawing.current = true;
              const p = pos(e);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvasRef.current?.getContext("2d");
              if (!ctx) return;
              const p = pos(e);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              hasStroke.current = true;
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
          />
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={submit}>
            {pending ? "Signing…" : "Sign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
