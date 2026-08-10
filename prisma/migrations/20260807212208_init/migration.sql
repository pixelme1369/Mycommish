-- CreateEnum
CREATE TYPE "PeriodSource" AS ENUM ('calculated', 'history');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ClientEventKind" AS ENUM ('cleared', 'pending', 'safe_cancel', 'same_month_cancel', 'clawback', 'cordoba_clawback', 'history_paid', 'history_subtract', 'low_credit_cleared');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('commission_credit', 'clawback_crm', 'clawback_cordoba', 'clawback_history', 'reversal');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('crm', 'cordoba', 'history');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAlias" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,

    CONSTRAINT "AgentAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPeriod" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "source" "PeriodSource" NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'open',
    "filename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CommissionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPeriod" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "unitsCleared" INTEGER NOT NULL DEFAULT 0,
    "totalClearedDebt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cancellationRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "rawTier" INTEGER NOT NULL DEFAULT 0,
    "adjustedTier" INTEGER NOT NULL DEFAULT 0,
    "tierRate" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "grossCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clawbackAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payout" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payoutType" TEXT NOT NULL DEFAULT 'commission',
    "qualityBonusEligible" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPenaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "nsfFlagged" BOOLEAN NOT NULL DEFAULT false,
    "pendingUnits" INTEGER NOT NULL DEFAULT 0,
    "pendingDebt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "AgentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIdentity" (
    "crmId" TEXT NOT NULL,
    "clientName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "enrolledDebt" DECIMAL(14,2),
    "creditScore" INTEGER,
    "payFreq" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIdentity_pkey" PRIMARY KEY ("crmId")
);

-- CreateTable
CREATE TABLE "ClientEvent" (
    "id" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "agentPeriodId" TEXT,
    "agentName" TEXT NOT NULL,
    "kind" "ClientEventKind" NOT NULL,
    "clientName" TEXT,
    "enrolledDate" TEXT,
    "firstPaymentClearedDate" TEXT,
    "droppedDate" TEXT,
    "payFreq" TEXT,
    "paymentsMade" INTEGER NOT NULL DEFAULT 0,
    "enrolledDebt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditScore" INTEGER,
    "isLowCredit" BOOLEAN NOT NULL DEFAULT false,
    "isCleared" BOOLEAN NOT NULL DEFAULT false,
    "clawbackApplied" BOOLEAN NOT NULL DEFAULT false,
    "commissionOnClient" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clawbackAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidRate" DECIMAL(8,6),
    "isLateActivation" BOOLEAN NOT NULL DEFAULT false,
    "originalClearedPeriod" TEXT,
    "uploadBatchId" TEXT,

    CONSTRAINT "ClientEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "crmId" TEXT,
    "agentName" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "agentPeriodId" TEXT,
    "reasonCode" TEXT,
    "note" TEXT,
    "uploadBatchId" TEXT,
    "reversesEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CordobaPaid" (
    "crmId" TEXT NOT NULL,
    "clientName" TEXT,
    "source" TEXT,
    "uploadedFilename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CordobaPaid_pkey" PRIMARY KEY ("crmId")
);

-- CreateTable
CREATE TABLE "CordobaChargebackSeen" (
    "crmId" TEXT NOT NULL,
    "clientName" TEXT,
    "uploadedFilename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CordobaChargebackSeen_pkey" PRIMARY KEY ("crmId")
);

-- CreateTable
CREATE TABLE "CordobaChargebackSnapshot" (
    "crmId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "assignedCompany" TEXT,
    "enrolledDate" TEXT,
    "clientName" TEXT,
    "status" TEXT,
    "marketingPayoutDebt" DECIMAL(14,2),
    "firstPaymentClearedDate" TEXT,
    "payFreq" TEXT,
    "paymentsMade" INTEGER,
    "marketingPaymentCleared" TEXT,
    "marketingPaymentChargeback" TEXT,
    "fileDroppedDate" TEXT,
    "uploadedFilename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CordobaChargebackSnapshot_pkey" PRIMARY KEY ("crmId")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "type" "UploadType" NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT,
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAlias_agentName_key" ON "AgentAlias"("agentName");

-- CreateIndex
CREATE INDEX "AgentAlias_agentId_idx" ON "AgentAlias"("agentId");

-- CreateIndex
CREATE INDEX "CommissionPeriod_periodLabel_idx" ON "CommissionPeriod"("periodLabel");

-- CreateIndex
CREATE INDEX "CommissionPeriod_source_periodLabel_idx" ON "CommissionPeriod"("source", "periodLabel");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPeriod_periodLabel_source_key" ON "CommissionPeriod"("periodLabel", "source");

-- CreateIndex
CREATE INDEX "AgentPeriod_agentName_idx" ON "AgentPeriod"("agentName");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPeriod_periodId_agentName_key" ON "AgentPeriod"("periodId", "agentName");

-- CreateIndex
CREATE INDEX "ClientEvent_crmId_idx" ON "ClientEvent"("crmId");

-- CreateIndex
CREATE INDEX "ClientEvent_periodId_idx" ON "ClientEvent"("periodId");

-- CreateIndex
CREATE INDEX "ClientEvent_agentPeriodId_idx" ON "ClientEvent"("agentPeriodId");

-- CreateIndex
CREATE INDEX "ClientEvent_crmId_isCleared_idx" ON "ClientEvent"("crmId", "isCleared");

-- CreateIndex
CREATE INDEX "ClientEvent_crmId_droppedDate_idx" ON "ClientEvent"("crmId", "droppedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reversesEntryId_key" ON "LedgerEntry"("reversesEntryId");

-- CreateIndex
CREATE INDEX "LedgerEntry_periodId_agentName_idx" ON "LedgerEntry"("periodId", "agentName");

-- CreateIndex
CREATE INDEX "LedgerEntry_crmId_idx" ON "LedgerEntry"("crmId");

-- CreateIndex
CREATE INDEX "LedgerEntry_uploadBatchId_idx" ON "LedgerEntry"("uploadBatchId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");

-- CreateIndex
CREATE INDEX "CordobaChargebackSnapshot_agentName_periodLabel_idx" ON "CordobaChargebackSnapshot"("agentName", "periodLabel");

-- CreateIndex
CREATE INDEX "UploadBatch_type_createdAt_idx" ON "UploadBatch"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentAlias" ADD CONSTRAINT "AgentAlias_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPeriod" ADD CONSTRAINT "AgentPeriod_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEvent" ADD CONSTRAINT "ClientEvent_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEvent" ADD CONSTRAINT "ClientEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEvent" ADD CONSTRAINT "ClientEvent_agentPeriodId_fkey" FOREIGN KEY ("agentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEvent" ADD CONSTRAINT "ClientEvent_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_agentPeriodId_fkey" FOREIGN KEY ("agentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CordobaPaid" ADD CONSTRAINT "CordobaPaid_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CordobaChargebackSeen" ADD CONSTRAINT "CordobaChargebackSeen_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CordobaChargebackSnapshot" ADD CONSTRAINT "CordobaChargebackSnapshot_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
