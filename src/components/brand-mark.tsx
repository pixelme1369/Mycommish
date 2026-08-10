import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
    hero: "text-5xl sm:text-6xl",
  };

  return (
    <Link
      href={href}
      className={cn(
        "font-heading tracking-tight text-foreground transition-opacity hover:opacity-80",
        sizes[size],
        className,
      )}
    >
      mycommish
    </Link>
  );
}
