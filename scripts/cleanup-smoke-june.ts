import "dotenv/config";
import { PrismaClient, PeriodSource } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Remove the Maria-only 2026-06 period created by scripts/smoke-crm-ingest.ts. */
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const june = await prisma.commissionPeriod.findFirst({
    where: { periodLabel: "2026-06", source: PeriodSource.calculated },
    include: {
      agentPeriods: true,
      _count: { select: { clientEvents: true, ledgerEntries: true } },
    },
  });

  if (!june) {
    console.log("No 2026-06 calculated period found.");
    await prisma.$disconnect();
    return;
  }

  console.log("Found", {
    id: june.id,
    filename: june.filename,
    agents: june.agentPeriods.map((a) => a.agentName),
    clientEvents: june._count.clientEvents,
    ledger: june._count.ledgerEntries,
  });

  const onlySmoke =
    june.filename === "smoke-test.csv" ||
    (june.agentPeriods.length === 1 && june.agentPeriods[0].agentName === "Maria");

  if (!onlySmoke) {
    console.log("Refusing to delete — does not look like smoke-test data.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Manual teardown (no cascade guarantee across all FKs in all directions)
  await prisma.ledgerEntry.deleteMany({ where: { periodId: june.id } });
  await prisma.clientEvent.deleteMany({ where: { periodId: june.id } });
  await prisma.agentPeriod.deleteMany({ where: { periodId: june.id } });
  await prisma.commissionPeriod.delete({ where: { id: june.id } });

  // Also drop the smoke upload batch if present
  await prisma.uploadBatch.deleteMany({ where: { filename: "smoke-test.csv" } });

  console.log("Deleted smoke-test 2026-06 period.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
