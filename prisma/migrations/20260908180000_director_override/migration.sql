-- Alex Tambouly Director override rollup + ledger type.

ALTER TABLE "AgentPeriod" ADD COLUMN IF NOT EXISTS "directorOverrideAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'director_override';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
