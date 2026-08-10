/**
 * Seed (or upsert) an admin login.
 *
 *   npx tsx scripts/seed-admin.ts you@company.com "Your Name" [password]
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const displayName = (process.argv[3] || "").trim() || email;
  const password = process.argv[4] || "";
  if (!email) {
    console.error(
      'Usage: npx tsx scripts/seed-admin.ts you@company.com "Your Name" [password]',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const passwordHash = password
    ? await bcrypt.hash(password, 10)
    : undefined;

  const agent = await prisma.agent.upsert({
    where: { email },
    create: {
      email,
      displayName,
      isAdmin: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
    update: {
      displayName,
      isAdmin: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  console.log(`Admin ready: ${agent.displayName} <${agent.email}> id=${agent.id}`);
  if (passwordHash) {
    console.log("Password login enabled for that account.");
  } else {
    console.log("No password set — pass a 4th arg to set one.");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
