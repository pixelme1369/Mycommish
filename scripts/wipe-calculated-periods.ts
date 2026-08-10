/**
 * Wipe all calculated periods (and their ledger/events) so a clean CRM can be re-imported.
 * Cordoba paid/seen/snapshot tables are left alone.
 *
 *   npx tsx scripts/wipe-calculated-periods.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PeriodSource } from "../src/generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    select: { id: true, periodLabel: true },
  });
  console.log(`Found ${periods.length} calculated period(s):`, periods.map((p) => p.periodLabel).join(", "));

  const ids = periods.map((p) => p.id);
  if (!ids.length) {
    console.log("Nothing to wipe.");
    await prisma.$disconnect();
    return;
  }

  const ledger = await prisma.ledgerEntry.deleteMany({ where: { periodId: { in: ids } } });
  const events = await prisma.clientEvent.deleteMany({ where: { periodId: { in: ids } } });
  const agents = await prisma.agentPeriod.deleteMany({ where: { periodId: { in: ids } } });
  const deleted = await prisma.commissionPeriod.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `Wiped: periods=${deleted.count} agentPeriods=${agents.count} events=${events.count} ledger=${ledger.count}`,
  );
  console.log("Re-upload the CRM CSV from Admin.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
