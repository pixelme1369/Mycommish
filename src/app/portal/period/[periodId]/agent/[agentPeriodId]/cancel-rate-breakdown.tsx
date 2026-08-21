import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cancelRatePercent } from "@/lib/format";
import type { CancelRateBreakdown } from "@/lib/portal/queries";

const PENALTY_THRESHOLD = 25;

function periodMonthLabel(periodLabel: string): string {
  try {
    const [y, m] = periodLabel.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return periodLabel;
  }
}

export function CancelRateBreakdownSection({
  breakdown,
  storedRatePct,
}: {
  breakdown: CancelRateBreakdown;
  /** AgentPeriod.cancellationRate from commission calc (authoritative for pay). */
  storedRatePct: number;
}) {
  const month = periodMonthLabel(breakdown.periodLabel);
  const overThreshold = storedRatePct > PENALTY_THRESHOLD;
  const openCount = Math.max(0, breakdown.enrolledCount - breakdown.droppedCount);

  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg tracking-tight">How your cancel rate was calculated</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cancel rate uses files with an <span className="font-medium text-foreground">Enrolled Date</span> in{" "}
        {month} — not only files cleared this month. A file counts as dropped if it has any{" "}
        <span className="font-medium text-foreground">Dropped Date</span>.
      </p>

      <Card className="glass-panel mt-4 overflow-hidden py-0">
        <div className="border-b border-border/70 bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium tabular-nums text-foreground">
            {breakdown.droppedCount} dropped ÷ {breakdown.enrolledCount} enrolled in {month} ={" "}
            {cancelRatePercent(storedRatePct)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enrolled {breakdown.enrolledCount}
            <span className="mx-1.5">·</span>
            Dropped {breakdown.droppedCount}
            <span className="mx-1.5">·</span>
            Still open {openCount}
            {overThreshold ? (
              <>
                <span className="mx-1.5">·</span>
                <span className="text-destructive">
                  Over {PENALTY_THRESHOLD}% drops you one tier
                </span>
              </>
            ) : (
              <>
                <span className="mx-1.5">·</span>
                At or under {PENALTY_THRESHOLD}% — no tier penalty
              </>
            )}
          </p>
        </div>

        {breakdown.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No enrollments found for {month} for this Sales Rep yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium w-10">#</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Enrolled</th>
                  <th className="px-3 py-2 font-medium">Dropped</th>
                  <th className="px-3 py-2 font-medium">Counts as</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {breakdown.rows.map((r, i) => (
                  <tr key={r.crmId}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.externalId || r.crmId}
                    </td>
                    <td className="px-3 py-2">{r.clientName || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {r.enrolledDate || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {r.hasDropped ? r.droppedDate || "—" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.hasDropped ? (
                        <Badge variant="destructive" className="font-normal">
                          Dropped
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          Still open
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
