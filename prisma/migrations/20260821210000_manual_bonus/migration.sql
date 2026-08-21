-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'manual_bonus';

-- AlterTable
ALTER TABLE "AgentPeriod" ADD COLUMN "manualBonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ManualBonusStatus" AS ENUM ('pending', 'approved');

-- CreateTable
CREATE TABLE "ManualBonus" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentPeriodId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "ManualBonusStatus" NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualBonus_ledgerEntryId_key" ON "ManualBonus"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ManualBonus_agentPeriodId_status_idx" ON "ManualBonus"("agentPeriodId", "status");

-- CreateIndex
CREATE INDEX "ManualBonus_periodLabel_agentName_idx" ON "ManualBonus"("periodLabel", "agentName");

-- CreateIndex
CREATE INDEX "ManualBonus_status_createdAt_idx" ON "ManualBonus"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ManualBonus_createdById_idx" ON "ManualBonus"("createdById");

-- AddForeignKey
ALTER TABLE "ManualBonus" ADD CONSTRAINT "ManualBonus_agentPeriodId_fkey" FOREIGN KEY ("agentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBonus" ADD CONSTRAINT "ManualBonus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBonus" ADD CONSTRAINT "ManualBonus_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBonus" ADD CONSTRAINT "ManualBonus_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
