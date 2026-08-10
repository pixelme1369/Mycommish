/**
 * Apply known contractor company tags to Agent profiles whose displayName
 * or CRM alias matches the contractor list.
 *
 *   npx tsx scripts/sync-contractors.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CONTRACTOR_COMPANIES } from "../src/lib/agents/contractors";
import { agentIdentityKey } from "../src/lib/commission/calculator";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const agents = await prisma.agent.findMany({
    include: { aliases: true },
  });

  let updated = 0;
  for (const agent of agents) {
    const names = [agent.displayName, ...agent.aliases.map((a) => a.agentName)];
    let company: string | null = null;
    for (const n of names) {
      company = CONTRACTOR_COMPANIES[agentIdentityKey(n)] ?? null;
      if (company) break;
    }
    if (!company) continue;

    if (agent.employmentType === "contractor" && agent.companyName === company) {
      console.log(`ok  ${agent.displayName} → ${company}`);
      continue;
    }

    await prisma.agent.update({
      where: { id: agent.id },
      data: { employmentType: "contractor", companyName: company },
    });
    updated += 1;
    console.log(`set ${agent.displayName} → contractor · ${company}`);
  }

  console.log(`Done. Updated ${updated} agent(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
