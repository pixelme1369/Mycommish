import { money } from "@/lib/format";

export type CommissionLinkHit = {
  periodLabel: string;
  agentName: string;
  netCommission: number;
};

export function formatCommissionLinkSummary(hits: CommissionLinkHit[]): string {
  if (!hits.length) {
    return "No commission found yet for those Sales Rep names — check CRM spelling. You do not need to re-upload CRM once aliases match.";
  }
  const bits = hits.slice(0, 8).map(
    (h) => `${h.periodLabel} ${h.agentName} · net ${money(h.netCommission)}`,
  );
  const more = hits.length > 8 ? ` (+${hits.length - 8} more)` : "";
  return `Linked ${hits.length} period(s) — no CRM re-upload needed: ${bits.join("; ")}${more}`;
}
