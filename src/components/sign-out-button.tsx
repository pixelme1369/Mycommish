"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}
