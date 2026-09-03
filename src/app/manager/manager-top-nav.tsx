import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ManagerCommissionsMenu } from "@/app/manager/manager-commissions-menu";

export type ManagerTopNavActive =
  | "commissions"
  | "openers"
  | "files"
  | "goals"
  | "claims"
  | "bonuses"
  | "advances"
  | "agent-portal";

export function ManagerTopNav({
  active,
  pendingClaims = 0,
  /** Managers who also file personal commissions / opener pay. */
  showAgentPortal = false,
}: {
  active?: ManagerTopNavActive;
  pendingClaims?: number;
  showAgentPortal?: boolean;
}) {
  const items: { href: string; id: ManagerTopNavActive; label: string }[] = [
    { href: "/manager/files", id: "files", label: "All files" },
    { href: "/manager/goals", id: "goals", label: "Goals" },
    {
      href: "/manager/claims",
      id: "claims",
      label: pendingClaims ? `File claims (${pendingClaims})` : "File claims",
    },
    { href: "/manager/bonuses", id: "bonuses", label: "Bonus payouts" },
    { href: "/manager/advances", id: "advances", label: "Advances" },
  ];

  const commissionsActive = active === "commissions" || active === "openers";

  return (
    <>
      <ManagerCommissionsMenu active={commissionsActive} />
      {showAgentPortal ? (
        <Link
          href="/portal?personal=1"
          aria-current={active === "agent-portal" ? "page" : undefined}
          className={cn(
            buttonVariants({
              variant: active === "agent-portal" ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          My agent portal
        </Link>
      ) : null}
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={cn(
            buttonVariants({
              variant: active === item.id ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          {item.label}
        </Link>
      ))}
      <SignOutButton />
    </>
  );
}
