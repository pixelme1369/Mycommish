"use client";

import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { includeAgentInPeriodAction } from "@/app/admin/period-exclusion-actions";

export function ReinstatePeriodAgentButton({
  periodId,
  periodLabel,
  agentName,
}: {
  periodId: string;
  periodLabel: string;
  agentName: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      onClick={async () => {
        const fd = new FormData();
        fd.set("agentName", agentName);
        fd.set("periodLabel", periodLabel);
        fd.set("periodId", periodId);
        await includeAgentInPeriodAction(fd);
        router.refresh();
      }}
    >
      Restore to period
    </button>
  );
}
