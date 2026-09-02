import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DocumentsSectionNav({
  active,
}: {
  active: "statements" | "uploaded";
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Link
        href="/admin/statements"
        className={cn(
          buttonVariants({
            variant: active === "statements" ? "secondary" : "outline",
            size: "sm",
          }),
          "h-8",
        )}
      >
        Signed commissions
      </Link>
      <Link
        href="/admin/documents"
        className={cn(
          buttonVariants({
            variant: active === "uploaded" ? "secondary" : "outline",
            size: "sm",
          }),
          "h-8",
        )}
      >
        Uploaded documents
      </Link>
    </div>
  );
}
