import Link from "next/link";
import { requireSession } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import {
  agentRowsForLatestPeriods,
  cancelRatePercent,
  latestCalculatedPeriods,
  money,
  ratePercent,
} from "@/lib/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await requireSession();
  const aliasNames = session.user.aliasNames || [];
  const windowPeriods = await latestCalculatedPeriods();
  const windowLabels = windowPeriods.map((p) => p.periodLabel);

  // One login can map to multiple CRM spellings — show rows for all aliases.
  const rowSets = await Promise.all(aliasNames.map((n) => agentRowsForLatestPeriods(n)));
  const rows = rowSets.flatMap((s) => s.rows);
  // Dedupe by agentPeriod id, keep newest-first by period label
  const seen = new Set<string>();
  const unique = rows
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => b.period.periodLabel.localeCompare(a.period.periodLabel));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              mycommish
            </Link>{" "}
            · portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">My commissions</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {session.user.displayName}
            {windowLabels.length > 0 ? (
              <>
                {" "}
                · latest 2 calculated:{" "}
                <span className="font-medium text-zinc-800">{windowLabels.join(", ")}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {session.user.isAdmin ? (
            <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
              Admin →
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>

      {!aliasNames.length ? (
        <p className="mt-10 text-sm text-zinc-500">
          Your login has no CRM name aliases yet. Ask an admin to map your Sales Rep name(s) in
          Manage Agents.
        </p>
      ) : unique.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No activity in {windowLabels.join(" / ") || "the latest 2 periods"} for{" "}
          {aliasNames.join(", ")}.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Units</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Clawback</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Cancel %</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {unique.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.period.periodLabel}</td>
                  <td className="px-4 py-3">{r.agentName}</td>
                  <td className="px-4 py-3">{r.unitsCleared}</td>
                  <td className="px-4 py-3">
                    {r.cancellationPenaltyApplied
                      ? `${r.rawTier}→${r.adjustedTier}`
                      : r.adjustedTier || "—"}
                  </td>
                  <td className="px-4 py-3">{ratePercent(r.tierRate)}</td>
                  <td className="px-4 py-3">{money(r.grossCommission)}</td>
                  <td className="px-4 py-3">
                    {Number(r.clawbackAmount) > 0 ? (
                      <span className="text-red-700">-{money(r.clawbackAmount)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{money(r.netCommission)}</td>
                  <td className="px-4 py-3">{cancelRatePercent(r.cancellationRate)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/period/${r.periodId}/agent/${r.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
