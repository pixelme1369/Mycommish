import { prisma } from "@/lib/db";
import { DEFAULT_CLEAR_RATE_PCT } from "@/lib/portal/monthly-goal-math";

const SETTINGS_ID = "default";

function asPct(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return DEFAULT_CLEAR_RATE_PCT;
  const n = typeof v === "number" ? v : Number(v.toString());
  if (!Number.isFinite(n) || n < 1 || n > 100) return DEFAULT_CLEAR_RATE_PCT;
  return n;
}

export async function loadGoalClearRatePct(): Promise<number> {
  try {
    const row = await prisma.portalGoalSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    return asPct(row?.clearRatePct);
  } catch {
    return DEFAULT_CLEAR_RATE_PCT;
  }
}

export async function saveGoalClearRatePct(clearRatePct: number): Promise<void> {
  const pct = asPct(clearRatePct);
  await prisma.portalGoalSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, clearRatePct: pct },
    update: { clearRatePct: pct },
  });
}
