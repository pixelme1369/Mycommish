import Link from "next/link";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PeriodRebuiltMissing({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· Pay period</span>
          </span>
        }
        title="This period was rebuilt"
        description="A new CRM upload replaced this month. Open it from the current pay list — the old link no longer works."
      />
      <Link href={homeHref} className={cn(buttonVariants({ variant: "default" }), "mt-6")}>
        {homeLabel}
      </Link>
    </AppShell>
  );
}
