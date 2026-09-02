import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ManagerTopNavActive =
  | "commissions"
  | "openers"
  | "files"
  | "goals"
  | "claims"
  | "bonuses"
  | "advances";

export function ManagerTopNav({
  active,
  pendingClaims = 0,
}: {
  active?: ManagerTopNavActive;
  pendingClaims?: number;
}) {
  const items: { href: string; id: ManagerTopNavActive; label: string }[] = [
    { href: "/manager", id: "commissions", label: "Commissions" },
    { href: "/manager/openers", id: "openers", label: "Openers" },
    { href: "/manager/files", id: "files", label: "All files" },
    { href: "/manager/goals", id: "goals", label: "Goals" },
    { href: "/manager/claims", id: "claims", label: pendingClaims ? `File claims (${pendingClaims})` : "File claims" },
    { href: "/manager/bonuses", id: "bonuses", label: "Bonus payouts" },
    { href: "/manager/advances", id: "advances", label: "Advances" },
  ];

  return (
    <>
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
