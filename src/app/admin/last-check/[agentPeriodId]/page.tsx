import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ratePercent } from "@/lib/format";
import { loadLastCheck } from "@/lib/agents/last-check-load";
import { LastCheckExportButtons } from "./last-check-export";
import { LastCheckDetails } from "../last-check-details";

export const dynamic = "force-dynamic";

export default async function LastCheckPage({
  params,
}: {
  params: Promise<{ agentPeriodId: string }>;
}) {
  await requireAdmin();
  const { agentPeriodId } = await params;
  const view = await loadLastCheck(agentPeriodId);
  if (!view) notFound();

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· Last check</span>
          </span>
        }
        title={view.agentName}
        description={`${view.periodLabel} · upcoming pay periods · threshold-passed files minus clawbacks · ${view.tierLabel}${view.units > 0 && view.tierRate > 0 ? ` at ${ratePercent(view.tierRate)}` : ""}`}
        actions={
          <>
            <Link
              href={`/admin/periods/${view.periodId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Back to period
            </Link>
            <LastCheckExportButtons
              agentPeriodId={view.agentPeriodId}
              canGusto={view.gustoAmount > 0}
            />
            <SignOutButton />
          </>
        }
      />
      <LastCheckDetails view={view} />
    </AppShell>
  );
}
