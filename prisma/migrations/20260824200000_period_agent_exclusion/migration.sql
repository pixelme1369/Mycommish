-- Period-scoped agent exclusions (hide from one month's pay / Gusto only).

CREATE TABLE IF NOT EXISTS "PeriodAgentExclusion" (
  "id" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "agentNameKey" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodAgentExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeriodAgentExclusion_periodLabel_agentNameKey_key"
  ON "PeriodAgentExclusion"("periodLabel", "agentNameKey");
CREATE INDEX IF NOT EXISTS "PeriodAgentExclusion_periodLabel_idx"
  ON "PeriodAgentExclusion"("periodLabel");
CREATE INDEX IF NOT EXISTS "PeriodAgentExclusion_agentNameKey_idx"
  ON "PeriodAgentExclusion"("agentNameKey");

DO $$ BEGIN
  ALTER TABLE "PeriodAgentExclusion"
    ADD CONSTRAINT "PeriodAgentExclusion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
