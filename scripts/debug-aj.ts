import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PeriodSource } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    orderBy: { periodLabel: "desc" },
    include: {
      agentPeriods: {
        select: { agentName: true, unitsCleared: true, netCommission: true },
        orderBy: { agentName: "asc" },
      },
    },
  });

  console.log("All calculated periods (newest first):");
  for (const p of periods) {
    console.log(`  ${p.periodLabel} [${p.status}] agents=${p.agentPeriods.length}`);
  }

  const latest2 = periods.slice(0, 2).map((p) => p.periodLabel);
  console.log("\nLatest 2 labels:", latest2);

  const aj = await prisma.agentPeriod.findMany({
    where: { agentName: { contains: "AJ", mode: "insensitive" } },
    include: { period: true },
    orderBy: { period: { periodLabel: "desc" } },
  });
  console.log("\nAJ rows:");
  for (const r of aj) {
    console.log(
      `  ${r.period.periodLabel} source=${r.period.source} units=${r.unitsCleared} net=${r.netCommission}`,
    );
  }

  const inLatest = aj.filter((r) => latest2.includes(r.period.periodLabel) && r.period.source === "calculated");
  console.log("\nAJ in latest-2 calculated window:", inLatest.length);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
