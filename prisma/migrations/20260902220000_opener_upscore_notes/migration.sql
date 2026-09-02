-- AlterTable
ALTER TABLE "OpenerTransferLog" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "OpenerPeriodUpscore" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenerPeriodUpscore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenerPeriodUpscore_agentId_monthLabel_key" ON "OpenerPeriodUpscore"("agentId", "monthLabel");

-- CreateIndex
CREATE INDEX "OpenerPeriodUpscore_monthLabel_idx" ON "OpenerPeriodUpscore"("monthLabel");

-- AddForeignKey
ALTER TABLE "OpenerPeriodUpscore" ADD CONSTRAINT "OpenerPeriodUpscore_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenerPeriodUpscore" ADD CONSTRAINT "OpenerPeriodUpscore_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
