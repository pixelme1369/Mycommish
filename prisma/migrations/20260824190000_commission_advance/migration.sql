-- Commission advances: pay with one period, deduct from a later period.

ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'advance_paid';
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'advance_repay';

ALTER TABLE "AgentPeriod"
  ADD COLUMN IF NOT EXISTS "advancePaidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "advanceRepayAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CommissionAdvance" (
  "id" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "agentId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "payWithPeriodLabel" TEXT NOT NULL,
  "deductFromPeriodLabel" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "payAgentPeriodId" TEXT,
  "repayAgentPeriodId" TEXT,
  "payLedgerEntryId" TEXT,
  "repayLedgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionAdvance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionAdvance_payLedgerEntryId_key"
  ON "CommissionAdvance"("payLedgerEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionAdvance_repayLedgerEntryId_key"
  ON "CommissionAdvance"("repayLedgerEntryId");
CREATE INDEX IF NOT EXISTS "CommissionAdvance_agentName_idx" ON "CommissionAdvance"("agentName");
CREATE INDEX IF NOT EXISTS "CommissionAdvance_payWithPeriodLabel_idx" ON "CommissionAdvance"("payWithPeriodLabel");
CREATE INDEX IF NOT EXISTS "CommissionAdvance_deductFromPeriodLabel_idx" ON "CommissionAdvance"("deductFromPeriodLabel");
CREATE INDEX IF NOT EXISTS "CommissionAdvance_createdById_idx" ON "CommissionAdvance"("createdById");
CREATE INDEX IF NOT EXISTS "CommissionAdvance_cancelledAt_idx" ON "CommissionAdvance"("cancelledAt");

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_payAgentPeriodId_fkey"
    FOREIGN KEY ("payAgentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_repayAgentPeriodId_fkey"
    FOREIGN KEY ("repayAgentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_payLedgerEntryId_fkey"
    FOREIGN KEY ("payLedgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionAdvance"
    ADD CONSTRAINT "CommissionAdvance_repayLedgerEntryId_fkey"
    FOREIGN KEY ("repayLedgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
