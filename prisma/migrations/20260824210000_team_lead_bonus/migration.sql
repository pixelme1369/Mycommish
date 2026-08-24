-- Team-lead roster + per-unit bonus rollup / ledger type.

ALTER TABLE "AgentPeriod" ADD COLUMN IF NOT EXISTS "teamLeadBonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Prisma enum: add team_lead_bonus (Postgres ADD VALUE is non-transactional-safe with IF NOT EXISTS on PG 15+)
DO $$ BEGIN
  ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'team_lead_bonus';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamLead" (
  "id" TEXT NOT NULL,
  "leadAgentId" TEXT NOT NULL,
  "leadAgentName" TEXT NOT NULL,
  "ratePerUnit" DECIMAL(8,2) NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamLead_leadAgentId_key" ON "TeamLead"("leadAgentId");
CREATE INDEX IF NOT EXISTS "TeamLead_leadAgentName_idx" ON "TeamLead"("leadAgentName");

DO $$ BEGIN
  ALTER TABLE "TeamLead"
    ADD CONSTRAINT "TeamLead_leadAgentId_fkey"
    FOREIGN KEY ("leadAgentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "teamLeadId" TEXT NOT NULL,
  "memberAgentName" TEXT NOT NULL,
  "memberAgentNameKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamLeadId_memberAgentNameKey_key"
  ON "TeamMember"("teamLeadId", "memberAgentNameKey");
CREATE INDEX IF NOT EXISTS "TeamMember_memberAgentNameKey_idx" ON "TeamMember"("memberAgentNameKey");

DO $$ BEGIN
  ALTER TABLE "TeamMember"
    ADD CONSTRAINT "TeamMember_teamLeadId_fkey"
    FOREIGN KEY ("teamLeadId") REFERENCES "TeamLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
