"use client";

import { useSession } from "next-auth/react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function homePathForImpersonatedUser(user: {
  role?: string;
  isAdmin?: boolean;
} | undefined): string {
  const role = user?.role;
  if (user?.isAdmin || role === "admin" || role === "super_admin") {
    return "/admin";
  }
  if (role === "manager") return "/manager";
  return "/portal";
}

export function useLoginAsUser() {
  const { update } = useSession();
  const [pending, start] = useTransition();

  function loginAs(agentId: string) {
    start(async () => {
      const next = await update({ impersonateAgentId: agentId });
      if (!next?.user?.impersonatorAgentId) return;
      window.location.href = homePathForImpersonatedUser(next.user);
    });
  }

  return { loginAs, pending };
}

export function LoginAsUserButton({
  agentId,
  displayName,
  disabled,
  className,
  variant = "outline",
}: {
  agentId: string;
  displayName: string;
  disabled?: boolean;
  className?: string;
  variant?: "outline" | "ghost" | "default";
}) {
  const { loginAs, pending } = useLoginAsUser();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={cn(className)}
      disabled={disabled || pending}
      onClick={() => loginAs(agentId)}
      title={`Sign in as ${displayName}`}
    >
      {pending ? "Signing in…" : "Login as user"}
    </Button>
  );
}

export function StopImpersonationBanner() {
  const { data, update, status } = useSession();
  const [pending, start] = useTransition();

  const impersonatorId = data?.user?.impersonatorAgentId;
  if (status !== "authenticated" || !impersonatorId) return null;

  const asName = data.user.displayName || data.user.name || "user";
  const adminName = data.user.impersonatorDisplayName || "admin";

  function stop() {
    start(async () => {
      await update({ stopImpersonation: true });
      window.location.href = "/admin/agents";
    });
  }

  return (
    <div className="relative z-20 border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-2 sm:px-6">
        <p>
          Viewing as <span className="font-medium">{asName}</span>
          <span className="text-amber-800/80 dark:text-amber-100/70">
            {" "}
            (signed in as {adminName})
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-amber-600/40 bg-background"
          disabled={pending}
          onClick={stop}
        >
          {pending ? "Returning…" : "Return to admin"}
        </Button>
      </div>
    </div>
  );
}
