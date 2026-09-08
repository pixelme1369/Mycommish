/**
 * Re-apply Alex Director override on open calculated periods (2026-09+):
 * clear leftover team_lead_bonus, write tiered director_override.
 *
 * Usage: npx tsx scripts/refresh-alex-director-override.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient, PeriodSource, PeriodStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  applyDirectorOverrideForPeriod,
  applyDirectorOverrideToOpenPeriods,
} from "../src/lib/ingest/director-override";
import { applyTeamLeadBonusesForPeriod } from "../src/lib/teams/team-lead-bonus";
import { isAlexDirectorIdentity } from "../src/lib/commission/director-plan";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const periods = await prisma.commissionPeriod.findMany({
    where: {
      source: PeriodSource.calculated,
      status: PeriodStatus.open,
      periodLabel: { gte: "2026-09" },
    },
    orderBy: { periodLabel: "asc" },
    select: { id: true, periodLabel: true },
  });

  if (!periods.length) {
    console.log("No open calculated periods from 2026-09.");
    await prisma.$disconnect();
    return;
  }

  for (const p of periods) {
    const alex = await prisma.agentPeriod.findFirst({
      where: {
        periodId: p.id,
        agentName: { equals: "Alex Tambouly", mode: "insensitive" },
      },
      select: {
        id: true,
        agentName: true,
        teamLeadBonusAmount: true,
        directorOverrideAmount: true,
        netCommission: true,
        unitsCleared: true,
      },
    });
    // Also catch alternate spellings via identity scan
    const all = alex
      ? [alex]
      : (
          await prisma.agentPeriod.findMany({
            where: { periodId: p.id },
            select: {
              id: true,
              agentName: true,
              teamLeadBonusAmount: true,
              directorOverrideAmount: true,
              netCommission: true,
              unitsCleared: true,
            },
          })
        ).filter((r) => isAlexDirectorIdentity(r.agentName));

    const row = all[0];
    console.log(
      `${p.periodLabel}: Alex ${
        row
          ? `TLB=$${Number(row.teamLeadBonusAmount)} override=$${Number(row.directorOverrideAmount)} net=$${Number(row.netCommission)}`
          : "(no AgentPeriod yet)"
      }`,
    );

    if (dryRun) continue;

    await applyTeamLeadBonusesForPeriod(p.id);
    await applyDirectorOverrideForPeriod(p.id);

    const after = await prisma.agentPeriod.findFirst({
      where: {
        periodId: p.id,
        agentName: { equals: row?.agentName ?? "Alex Tambouly", mode: "insensitive" },
      },
      select: {
        teamLeadBonusAmount: true,
        directorOverrideAmount: true,
        netCommission: true,
        notes: true,
      },
    });
    if (after) {
      console.log(
        `  → TLB=$${Number(after.teamLeadBonusAmount)} override=$${Number(after.directorOverrideAmount)} net=$${Number(after.netCommission)}`,
      );
      if (after.notes) console.log(`  notes: ${after.notes}`);
    }
  }

  if (dryRun) {
    console.log("Dry run only — no writes. Re-run without --dry-run to apply.");
  } else {
    // Also refresh any other open months (pre-2026-09 TLB untouched by director apply).
    await applyDirectorOverrideToOpenPeriods();
    console.log("Done.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
