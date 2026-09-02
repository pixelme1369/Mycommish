"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalTopBar({
  staffHref,
  staffLabel,
  commissionsHref = "/portal",
  filesHref = "/portal/files",
  dailyTasksHref = "/portal/daily-tasks",
  openersHref,
  opener = false,
}: {
  staffHref?: string;
  staffLabel?: string;
  commissionsHref?: string;
  filesHref?: string;
  dailyTasksHref?: string;
  /** Show Openers tab (managers/admins reviewing opener pay). */
  openersHref?: string;
  /** Opener home is the transfer log, not agent commissions. */
  opener?: boolean;
}) {
  const pathname = usePathname() || "/portal";

  const nav = [
    {
      href: commissionsHref,
      label: opener ? "Transfers" : "Commissions",
      match: (p: string) =>
        p === commissionsHref ||
        p.startsWith("/portal/period/") ||
        p.startsWith("/manager/period/"),
    },
    ...(openersHref
      ? [
          {
            href: openersHref,
            label: "Openers",
            match: (p: string) =>
              p.startsWith("/manager/openers") || p.startsWith("/admin/openers"),
          },
        ]
      : []),
    {
      href: "/portal/goals",
      label: "Goals",
      match: (p: string) => p.startsWith("/portal/goals"),
    },
    {
      href: "/portal/documents",
      label: "Signed documents",
      match: (p: string) => p.startsWith("/portal/documents"),
    },
    {
      href: dailyTasksHref,
      label: "Daily Tasks",
      match: (p: string) => p.startsWith("/portal/daily-tasks"),
    },
    {
      href: filesHref,
      label: filesHref.includes("/manager") ? "All files" : "My files",
      match: (p: string) =>
        p.startsWith("/portal/files") || p.startsWith("/manager/files"),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
        <BrandMark
          size="sm"
          variant="full"
          href={commissionsHref}
          className="max-w-[8.25rem]"
        />
        <nav className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1 ring-1 ring-border/50">
          {nav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {staffHref && staffLabel ? (
          <Link
            href={staffHref}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {staffLabel}
          </Link>
        ) : null}
        <SignOutButton variant="ghost" />
      </div>
    </div>
  );
}
