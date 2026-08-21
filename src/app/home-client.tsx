"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { DotGridBg } from "@/components/dot-grid-bg";
import { FadeIn } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomeClient() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[oklch(0.99_0.005_150)]">
      {/* Soft brand wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(900px 520px at 18% 12%, oklch(0.92 0.05 150 / 0.45), transparent 60%),
            radial-gradient(720px 480px at 88% 78%, oklch(0.94 0.03 150 / 0.35), transparent 55%),
            linear-gradient(180deg, oklch(0.995 0.004 150) 0%, oklch(0.98 0.01 150) 100%)
          `,
        }}
      />

      {/* Interactive Framer-style dot grid in brand green */}
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <DotGridBg className="pointer-events-auto" />
      </div>

      {/* Readability vignette over the grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, oklch(0.995 0.004 150 / 0.88) 0%, oklch(0.995 0.004 150 / 0.55) 42%, transparent 72%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <FadeIn y={8}>
          <BrandMark size="sm" variant="mark" href="/" />
        </FadeIn>
        <FadeIn delay={0.06} y={8}>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background/70 backdrop-blur-sm")}
          >
            Sign in
          </Link>
        </FadeIn>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 pt-10 sm:pb-28 sm:pt-6">
        <FadeIn delay={0.04}>
          <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
            American Debt Protection
          </p>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-5">
          <BrandMark size="hero" variant="full" href="/login" className="max-w-[16rem] sm:max-w-[20rem]" />
        </FadeIn>

        <FadeIn delay={0.18} className="mt-8 max-w-xl">
          <p className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            Your commissions. Clear, accurate, always accessible.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Track earnings, review payouts, and see every adjustment — all in one place.
          </p>
        </FadeIn>

        <FadeIn delay={0.28} className="mt-10">
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-7 text-base shadow-sm")}
          >
            View My Commissions
          </Link>
        </FadeIn>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-8">
        <FadeIn delay={0.35} y={6}>
          <p className="text-xs text-muted-foreground/80">
            Secure access · ADP commission portal
          </p>
        </FadeIn>
      </footer>
    </div>
  );
}
