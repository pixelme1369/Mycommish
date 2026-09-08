import {
  getFixedRate,
  getTier,
  getTierTable,
  usesCustomTier,
  type TierBand,
} from "@/lib/commission/calculator";
import { isAlexDirectorPlan } from "@/lib/commission/director-plan";

export type EnrollmentPayPreview = {
  units: number;
  debt: number;
  rate: number;
  pay: number;
  label: string;
  tier: number | null;
  fixed: boolean;
};

/** Prefer a CRM alias that has a contract/legacy ladder, else the first alias. */
export function pickCommissionAgentName(aliases: string[]): string | null {
  const names = aliases.map((n) => n.trim()).filter(Boolean);
  for (const n of names) {
    if (getFixedRate(n) != null || usesCustomTier(n) || isAlexDirectorPlan(n, "2099-01")) {
      return n;
    }
  }
  return names[0] ?? null;
}

export function enrollmentPayPreview(
  agentName: string | null,
  units: number,
  enrolledDebt: number,
  periodLabel?: string | null,
): EnrollmentPayPreview {
  const debt = enrolledDebt > 0 ? enrolledDebt : 0;
  const u = Math.max(0, Math.floor(units));
  const director = isAlexDirectorPlan(agentName, periodLabel);
  const fixed = director ? null : getFixedRate(agentName, periodLabel);
  const pay = (rate: number) => Math.round(rate * debt * 100) / 100;

  if (director) {
    return {
      units: u,
      debt,
      rate: 0,
      pay: 0,
      label: "Director plan — house deals ($0 personal)",
      tier: null,
      fixed: false,
    };
  }

  if (u < 1 || debt <= 0) {
    return {
      units: u,
      debt,
      rate: fixed ?? 0,
      pay: 0,
      label: fixed != null ? "Fixed rate (contract)" : "Need 1 enrolled file",
      tier: null,
      fixed: fixed != null,
    };
  }

  if (fixed != null) {
    return {
      units: u,
      debt,
      rate: fixed,
      pay: pay(fixed),
      label: "Fixed rate (contract)",
      tier: getTier(u, agentName).tier,
      fixed: true,
    };
  }

  const t = getTier(u, agentName);
  return {
    units: u,
    debt,
    rate: t.rate,
    pay: pay(t.rate),
    label: t.label,
    tier: t.tier,
    fixed: false,
  };
}

export function commissionBandsForAgent(agentName: string | null): ReadonlyArray<TierBand> {
  return getTierTable(agentName);
}

export function bandRange(band: TierBand): string {
  return band.high == null ? `${band.low}+` : `${band.low}–${band.high}`;
}
