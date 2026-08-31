"use client";

import Link from "next/link";
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
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-[oklch(0.99_0.005_150)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(900px 520px at 18% 8%, oklch(0.92 0.05 150 / 0.4), transparent 60%),
            radial-gradient(720px 480px at 92% 88%, oklch(0.94 0.03 150 / 0.28), transparent 55%),
            linear-gradient(180deg, oklch(0.995 0.004 150) 0%, oklch(0.985 0.008 150) 100%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8 sm:px-0 sm:py-10">
        <header className="flex items-center justify-between gap-4">
          <FadeIn y={6}>
            <BrandMark size="sm" variant="full" href="/" className="max-w-[8.5rem]" />
          </FadeIn>
          <FadeIn delay={0.04} y={6}>
            <Link
              href="/"
              className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Home
            </Link>
          </FadeIn>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12">
          <FadeIn delay={0.06}>
            <h1 className="font-heading text-3xl tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-muted-foreground">
              {googleEnabled
                ? "Sign in with Google or your password."
                : "Sign in with your email and password."}
            </p>
          </FadeIn>

          {message ? (
            <FadeIn delay={0.1} className="mt-6">
              <Alert variant="destructive">
                <AlertTitle>Couldn’t sign in</AlertTitle>
                <AlertDescription>
                  <p>{message}</p>
                  {errorCode ? (
                    <p className="mt-2 font-mono text-xs opacity-80">error={errorCode}</p>
                  ) : null}
                </AlertDescription>
              </Alert>
            </FadeIn>
          ) : null}

          <FadeIn delay={0.14} className="mt-8">
            <SignIn googleEnabled={googleEnabled} />
          </FadeIn>
        </main>
      </div>
    </div>
  );
}
