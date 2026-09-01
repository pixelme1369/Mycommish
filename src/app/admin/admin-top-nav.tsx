import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminTopNavActive = "manual-inputs" | "goals";

export function AdminTopNav({
  isSuperAdmin,
  pendingManualBonusCount = 0,
  active,
}: {
  isSuperAdmin: boolean;
  pendingManualBonusCount?: number;
  active?: AdminTopNavActive;
}) {
  return (
    <>
      <Link
        href="/admin/daily-tasks"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Daily Tasks
      </Link>
      <Link
        href="/manager/advances"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Advances
      </Link>
      <Link
        href="/admin/claims"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        File claims
      </Link>
      <Link
        href="/admin/statements"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Signed PDFs
      </Link>
      <Link
        href="/admin/agents"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Users
      </Link>
      <Link
        href="/admin/manual-inputs"
        aria-current={active === "manual-inputs" ? "page" : undefined}
        className={cn(
          buttonVariants({
            variant: active === "manual-inputs" ? "default" : "outline",
            size: "sm",
          }),
        )}
      >
        Manual inputs
      </Link>
      {isSuperAdmin ? (
        <>
          <Link
            href="/superadmin/goals"
            aria-current={active === "goals" ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: active === "goals" ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            Goals
          </Link>
          <Link
            href="/superadmin/team-leads"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Team leads
          </Link>
          <Link
            href="/superadmin/manual-bonuses"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Manual bonuses
            {pendingManualBonusCount > 0 ? ` (${pendingManualBonusCount})` : ""}
          </Link>
        </>
      ) : (
        <Link
          href="/portal"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Portal
        </Link>
      )}
      <Link
        href="/manager"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Manager view
      </Link>
      <SignOutButton />
    </>
  );
}
