"use client";

import { BrandMark } from "@/components/brand-mark";
import { FadeIn } from "@/components/motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SignIn } from "./sign-in-button";

export function LoginClient({
  message,
  errorCode,
  googleEnabled,
}: {
  message: string | null;
  errorCode: string | null;
  googleEnabled: boolean;
}) {
  return (
    <div className="flex min-h-svh flex-1 flex-col lg:flex-row">
      <aside className="relative flex overflow-hidden bg-[oklch(0.22_0.04_150)] px-8 py-10 text-primary-foreground sm:px-12 lg:w-[48%] lg:px-14 lg:py-16 xl:w-1/2">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(to right, oklch(0.85 0.05 150 / 0.45) 1px, transparent 1px),
              linear-gradient(to bottom, oklch(0.85 0.05 150 / 0.45) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-1/4 size-[28rem] rounded-full bg-[oklch(0.53_0.15_150/0.35)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 size-[22rem] rounded-full bg-[oklch(0.35_0.05_50/0.35)] blur-3xl" />

        <div className="relative flex w-full max-w-md flex-col justify-between gap-10">
          <FadeIn y={16}>
            <p className="text-xs font-medium tracking-[0.2em] text-[oklch(0.82_0.08_150)] uppercase">
              American Debt Relief
            </p>
            <BrandMark
              size="hero"
              href="/"
              className="mt-3 block text-[oklch(0.98_0.02_155)] hover:opacity-90"
            />
            <p className="mt-4 max-w-sm text-base text-[oklch(0.82_0.02_150)]">
              Agent commission portal
            </p>
          </FadeIn>

          <FadeIn delay={0.15} y={20} className="hidden lg:block">
            <div
              className="rounded-lg border border-[oklch(0.85_0.05_150/0.22)] bg-[oklch(0.18_0.035_150/0.5)] p-4 backdrop-blur-sm"
              aria-hidden
            >
              <div className="grid grid-cols-4 gap-2 border-b border-[oklch(0.85_0.05_150/0.18)] pb-2 text-[10px] font-medium tracking-[0.14em] text-[oklch(0.75_0.06_150)] uppercase">
                <span>Date</span>
                <span className="col-span-2">Client</span>
                <span className="text-right">Amount</span>
              </div>
              {[0.35, 0.22, 0.28, 0.18].map((opacity, i) => (
                <div
                  key={i}
                  className="mt-3 grid grid-cols-4 gap-2"
                  style={{ opacity }}
                >
                  <div className="h-2 rounded-sm bg-[oklch(0.85_0.02_100/0.35)]" />
                  <div className="col-span-2 h-2 rounded-sm bg-[oklch(0.85_0.02_100/0.35)]" />
                  <div className="ml-auto h-2 w-14 rounded-sm bg-[oklch(0.7_0.14_150/0.55)]" />
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col justify-center bg-background px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <FadeIn delay={0.08}>
            <h1 className="font-heading text-3xl tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-muted-foreground">
              {googleEnabled
                ? "Sign in with Google or your password. Your admin must add your email first."
                : "Sign in with the email and password your admin set up."}
            </p>
          </FadeIn>

          {message ? (
            <FadeIn delay={0.12} className="mt-6">
              <Alert variant="destructive">
                <AlertTitle>Couldn’t sign in</AlertTitle>
                <AlertDescription>
                  <p>{message}</p>
                  {errorCode ? (
                    <p className="mt-2 font-mono text-xs opacity-80">
                      error={errorCode}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            </FadeIn>
          ) : null}

          <FadeIn delay={0.16} className="mt-8">
            <SignIn googleEnabled={googleEnabled} />
          </FadeIn>
        </div>
      </main>
    </div>
  );
}
