"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { FadeIn } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomeClient() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-50" />
      <div className="pointer-events-none absolute -left-24 top-10 size-[28rem] rounded-full bg-[oklch(0.85_0.07_195/0.35)] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-[24rem] rounded-full bg-[oklch(0.88_0.05_230/0.4)] blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-20">
        <FadeIn>
          <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
            American Debt Relief
          </p>
        </FadeIn>
        <FadeIn delay={0.08} className="mt-3">
          <BrandMark size="hero" href="/login" className="block" />
        </FadeIn>
        <FadeIn delay={0.16} className="mt-5 max-w-md">
          <p className="text-lg text-muted-foreground">
            Your commission ledger — latest calculated periods, clawbacks, and Cordoba
            payouts in one place.
          </p>
        </FadeIn>
        <FadeIn delay={0.28} className="mt-10">
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-base")}
          >
            Sign in
          </Link>
        </FadeIn>
      </main>
    </div>
  );
}
