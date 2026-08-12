"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Dot = {
  bx: number;
  by: number;
  inclination: number;
  ascension: number;
  phase: number;
  speedMult: number;
};

function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Interactive dot-grid background (Framer Dot Grid BG–style), tinted with brand green.
 */
export function DotGridBg({
  className,
  dotSize = 2.25,
  dotSpacing = 30,
  orbitSpeed = 1.35,
  impactRadius = 110,
  scaleOnHover = 1.75,
  enableRevolve = true,
}: {
  className?: string;
  dotSize?: number;
  dotSpacing?: number;
  orbitSpeed?: number;
  impactRadius?: number;
  scaleOnHover?: number;
  enableRevolve?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const revolve = enableRevolve && !reduceMotion && !coarse;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let mouse = { x: -9999, y: -9999 };
    let hovering = false;
    let leaveTs = 0;
    let prevTs = 0;
    let raf = 0;
    let globalAngle = 0;
    let dots: Dot[] = [];
    // Brand primary green ≈ oklch(0.527 0.154 150) → rgb
    const rgb = { r: 34, g: 140, b: 78 };

    function buildDots() {
      dots = [];
      const cols = Math.ceil(W / dotSpacing) + 2;
      const rows = Math.ceil(H / dotSpacing) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            bx: c * dotSpacing,
            by: r * dotSpacing,
            inclination: Math.random() * Math.PI,
            ascension: Math.random() * Math.PI * 2,
            phase: Math.random() * Math.PI * 2,
            speedMult: 0.7 + Math.random() * 0.6,
          });
        }
      }
    }

    function resize() {
      const rect = el.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      el.width = W * dpr;
      el.height = H * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onEnter(e: MouseEvent) {
      onMove(e);
      hovering = true;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
      hovering = false;
      leaveTs = performance.now();
    }

    if (!coarse) {
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    }

    function loop(ts: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((ts - (prevTs || ts)) / 1000, 0.05);
      prevTs = ts;
      if (revolve) globalAngle += orbitSpeed * dt;

      context.clearRect(0, 0, W, H);

      const mx = mouse.x;
      const my = mouse.y;
      const timeSinceLeave = hovering ? 0 : Math.max(0, ts - leaveTs) / 1000;
      const decay = hovering ? 1 : smoothstep(Math.max(0, 1 - timeSinceLeave * 1.5));

      for (const d of dots) {
        const dx = d.bx - mx;
        const dy = d.by - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inRange = dist < impactRadius && dist > 0;

        let x = d.bx;
        let y = d.by;
        let scale = 1;
        let alpha = 0.22;

        if (inRange && !reduceMotion) {
          const t = dist / impactRadius;
          const inf = smoothstep(1 - t) * decay;
          if (revolve) {
            const orbitR = (1 - t) * dotSpacing * 0.7 * inf;
            const theta = globalAngle * d.speedMult + d.phase;
            const cosA = Math.cos(d.ascension);
            const sinA = Math.sin(d.ascension);
            const cosI = Math.cos(d.inclination);
            const sinI = Math.sin(d.inclination);
            const lx = Math.cos(theta);
            const ly = Math.sin(theta) * cosI;
            const lz = Math.sin(theta) * sinI;
            const ox = (lx * cosA - ly * sinA) * orbitR;
            const oy = (lx * sinA + ly * cosA) * orbitR;
            x = d.bx + ox;
            y = d.by + oy;
            const depthScale = 0.75 + 0.25 * ((lz + 1) * 0.5);
            scale = (1 + (scaleOnHover - 1) * inf) * depthScale;
            alpha = (0.22 + 0.7 * inf) * depthScale;
          } else {
            scale = 1 + (scaleOnHover - 1) * inf;
            alpha = 0.22 + 0.7 * inf;
          }
        }

        const r = (dotSize / 2) * scale;
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
        context.fill();
      }
    }

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [dotSize, dotSpacing, orbitSpeed, impactRadius, scaleOnHover, enableRevolve]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-auto absolute inset-0 size-full", className)}
    />
  );
}
