import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** Bump when adding Prisma models so hot-reload drops a stale singleton. */
  prismaSchemaEpoch?: number;
};

/** Must match schema additions that need a fresh PrismaClient in `next dev`. */
const PRISMA_SCHEMA_EPOCH = 26;

/** Quiet pg's sslmode deprecation warning against Neon URLs. */
function neonCompatibleUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("uselibpqcompat")) {
      u.searchParams.set("uselibpqcompat", "true");
    }
    if (!u.searchParams.get("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString: neonCompatibleUrl(connectionString) });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient() {
  const client = globalForPrisma.prisma as
    | (PrismaClient & {
        commissionStatement?: unknown;
        fileClaim?: unknown;
        managerBonusPayout?: unknown;
        manualBonus?: unknown;
        commissionAdvance?: unknown;
        periodAgentExclusion?: unknown;
        teamLead?: unknown;
      })
    | undefined;
  const stale =
    !client ||
    globalForPrisma.prismaSchemaEpoch !== PRISMA_SCHEMA_EPOCH ||
    typeof client.fileClaim === "undefined" ||
    typeof client.commissionStatement === "undefined" ||
    typeof client.managerBonusPayout === "undefined" ||
    typeof client.manualBonus === "undefined" ||
    typeof client.commissionAdvance === "undefined" ||
    typeof client.periodAgentExclusion === "undefined" ||
    typeof client.teamLead === "undefined";

  if (stale) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaEpoch = PRISMA_SCHEMA_EPOCH;
  }

  return globalForPrisma.prisma!;
}

export const prisma = getPrismaClient();
