/** Net pay: gross − clawbacks + manual bonuses + team-lead bonus + advances paid − advance repayments (floored at 0). */
export function computeNetCommission(
  grossCommission: number,
  clawbackAmount: number,
  manualBonusAmount = 0,
  advancePaidAmount = 0,
  advanceRepayAmount = 0,
  teamLeadBonusAmount = 0,
): number {
  return Math.max(
    0,
    Math.round(
      (grossCommission -
        clawbackAmount +
        manualBonusAmount +
        teamLeadBonusAmount +
        advancePaidAmount -
        advanceRepayAmount) *
        100,
    ) / 100,
  );
}

/** Dollars owed to a team lead: teammate cleared units × rate. */
export function computeTeamLeadBonusAmount(
  teamUnitsCleared: number,
  ratePerUnit: number,
): number {
  const units = Math.max(0, Math.floor(teamUnitsCleared));
  const rate = Number(ratePerUnit) || 0;
  if (units <= 0 || rate <= 0) return 0;
  return Math.round(units * rate * 100) / 100;
}

/** Parse `Team bonus: 778 units × $15` / `Period units bonus: …` from ledger note. */
export function parseTeamLeadBonusNote(note: string | null | undefined): {
  teamUnits: number;
  ratePerUnit: number;
  scopeLabel: string;
} | null {
  if (!note) return null;
  const m = note.match(
    /^(Team bonus|Period units bonus):\s*(\d+)\s+units?\s*×\s*\$([\d.]+)\s*$/i,
  );
  if (!m) return null;
  const scopeLabel =
    m[1].toLowerCase().startsWith("period")
      ? "All period units"
      : "Team roster units";
  return {
    teamUnits: Number(m[2]),
    ratePerUnit: Number(m[3]),
    scopeLabel,
  };
}
