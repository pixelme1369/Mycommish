import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official transparent lockup — original colors, no edits. */
const LOGO_SRC = "/brand/mycommish-logo-v4.png";
/** Transparent M cropped from the lockup. */
const MARK_SRC = "/brand/mycommish-mark-v4.png";

const markSizes = {
  sm: 28,
  md: 36,
  lg: 48,
  hero: 72,
} as const;

/**
 * Brand lockup from the official transparent logo.
 * Uses <img> so alpha isn’t flattened by the image optimizer.
 */
export function BrandMark({
  href = "/",
  size = "md",
  variant = "auto",
  tone = "solid",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg" | "hero";
  /** auto: mark for sm, full lockup for md+ */
  variant?: "auto" | "mark" | "full";
  /** soft = slightly faded (dark panels) */
  tone?: "solid" | "soft";
  className?: string;
}) {
  const mode = variant === "auto" ? (size === "sm" ? "mark" : "full") : variant;
  const soft = tone === "soft";

  if (mode === "mark") {
    const px = markSizes[size];
    return (
      <Link
        href={href}
        aria-label="mycommish home"
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-transparent",
          soft
            ? "opacity-70 transition-opacity hover:opacity-85"
            : "transition-opacity hover:opacity-85",
          className,
        )}
        style={{ width: px, height: px }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MARK_SRC}
          alt=""
          width={px}
          height={px}
          className="block size-full object-contain"
          draggable={false}
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label="mycommish — Track · Calculate · Pay"
      className={cn(
        "inline-block shrink-0 bg-transparent",
        soft
          ? "opacity-95 transition-opacity hover:opacity-100"
          : "transition-opacity hover:opacity-95",
        size === "sm" && "w-28",
        size === "md" && "w-40",
        size === "lg" && "w-56",
        size === "hero" && "w-full max-w-md",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="mycommish"
        width={1024}
        height={781}
        className="block h-auto w-full"
        draggable={false}
      />
    </Link>
  );
}
