"use client";

import { BrandMark } from "@/components/brand-mark";
import { FadeIn } from "@/components/motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { SignIn } from "./sign-in-button";

export function LoginClient({
  message,
  errorCode,
}: {
  message: string | null;
  errorCode: string | null;
}) {
  return (
    <div className="relative flex min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 rounded-full bg-[oklch(0.88_0.06_195/0.35)] blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-md flex-col justify-center px-6 py-16">
        <FadeIn>
          <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
            American Debt Relief
          </p>
          <BrandMark size="lg" href="/" className="mt-2 block" />
          <p className="mt-3 text-muted-foreground">
            Sign in with the email and password your admin set up.
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

        <FadeIn delay={0.15} className="mt-8">
          <Card className="glass-panel border-border/70 shadow-md">
            <CardContent className="pt-6">
              <SignIn />
            </CardContent>
          </Card>
        </FadeIn>
      </main>
    </div>
  );
}
