import "dotenv/config";
import { PrismaClient, PeriodSource } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { agentRowsForLatestPeriods, listAgentNamesInLatestPeriods } from "../src/lib/portal/queries";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const names = (await listAgentNamesInLatestPeriods()).filter((n) =>
    n.toLowerCase().includes("valipour"),
  );
  console.log("picker names (latest window):", names.map((n) => JSON.stringify(n)));

  const { periods, rows } = await agentRowsForLatestPeriods("AJ Valipour");
  console.log(
    "AJ query latest periods",
    periods.map((p) => p.periodLabel),
    "rows",
    rows.map((r) => r.period.periodLabel),
  );

  const allAj = await prisma.agentPeriod.findMany({
    where: { agentName: { contains: "Valipour", mode: "insensitive" } },
    select: { agentName: true, period: { select: { periodLabel: true } } },
  });
  const variants = [...new Set(allAj.map((a) => a.agentName))];
  console.log("DB name variants:", variants.map((v) => JSON.stringify(v)));
  console.log(
    "by variant months:",
    variants.map((v) => ({
      name: v,
      months: allAj.filter((a) => a.agentName === v).map((a) => a.period.periodLabel),
    })),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
