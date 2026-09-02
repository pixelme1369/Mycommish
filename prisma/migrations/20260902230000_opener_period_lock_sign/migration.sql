-- CreateTable
CREATE TABLE "OpenerCommissionPeriod" (
    "id" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenerCommissionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenerCommissionStatement" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "status" "StatementSignStatus" NOT NULL DEFAULT 'unsigned',
    "approvedTransfers" INTEGER,
    "commissionTotal" DECIMAL(14,2),
    "upscore" DECIMAL(14,2),
    "totalPayout" DECIMAL(14,2),
    "agentTypedName" TEXT,
    "agentSignaturePng" BYTEA,
    "agentSignedAt" TIMESTAMP(3),
    "agentSignedById" TEXT,
    "managerTypedName" TEXT,
    "managerSignaturePng" BYTEA,
    "managerSignedAt" TIMESTAMP(3),
    "managerSignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenerCommissionStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenerPaidFile" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "openerName" TEXT NOT NULL,
    "transferYmd" TEXT NOT NULL,
    "forthId" TEXT NOT NULL,
    "debtLoad" DECIMAL(14,2) NOT NULL,
    "stageTitle" TEXT,
    "status" TEXT,
    "commission" DECIMAL(14,2) NOT NULL,
    "payStatus" "OpenerPayStatus" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "unmatched" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpenerPaidFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenerPaidUpscore" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "openerName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "OpenerPaidUpscore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenerCommissionPeriod_monthLabel_key" ON "OpenerCommissionPeriod"("monthLabel");

-- CreateIndex
CREATE UNIQUE INDEX "OpenerCommissionStatement_agentId_monthLabel_key" ON "OpenerCommissionStatement"("agentId", "monthLabel");

-- CreateIndex
CREATE INDEX "OpenerCommissionStatement_monthLabel_status_idx" ON "OpenerCommissionStatement"("monthLabel", "status");

-- CreateIndex
CREATE INDEX "OpenerCommissionStatement_status_idx" ON "OpenerCommissionStatement"("status");

-- CreateIndex
CREATE INDEX "OpenerPaidFile_periodId_agentId_idx" ON "OpenerPaidFile"("periodId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenerPaidUpscore_periodId_agentId_key" ON "OpenerPaidUpscore"("periodId", "agentId");

-- AddForeignKey
ALTER TABLE "OpenerCommissionPeriod" ADD CONSTRAINT "OpenerCommissionPeriod_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerCommissionStatement" ADD CONSTRAINT "OpenerCommissionStatement_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerCommissionStatement" ADD CONSTRAINT "OpenerCommissionStatement_agentSignedById_fkey" FOREIGN KEY ("agentSignedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerCommissionStatement" ADD CONSTRAINT "OpenerCommissionStatement_managerSignedById_fkey" FOREIGN KEY ("managerSignedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerPaidFile" ADD CONSTRAINT "OpenerPaidFile_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "OpenerCommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerPaidUpscore" ADD CONSTRAINT "OpenerPaidUpscore_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "OpenerCommissionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
