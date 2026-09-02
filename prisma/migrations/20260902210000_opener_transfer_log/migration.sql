-- CreateEnum
CREATE TYPE "OpenerPayStatus" AS ENUM ('approved', 'excluded_canceled');

-- CreateTable
CREATE TABLE "OpenerTransferLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "transferYmd" TEXT NOT NULL,
    "forthId" TEXT NOT NULL,
    "debtLoad" DECIMAL(14,2) NOT NULL,
    "stageTitle" TEXT,
    "status" TEXT,
    "commission" DECIMAL(14,2) NOT NULL,
    "payStatus" "OpenerPayStatus" NOT NULL,
    "payStatusOverridden" BOOLEAN NOT NULL DEFAULT false,
    "unmatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenerTransferLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenerTransferLog_forthId_key" ON "OpenerTransferLog"("forthId");

-- CreateIndex
CREATE INDEX "OpenerTransferLog_agentId_transferYmd_idx" ON "OpenerTransferLog"("agentId", "transferYmd");

-- CreateIndex
CREATE INDEX "OpenerTransferLog_payStatus_idx" ON "OpenerTransferLog"("payStatus");

-- AddForeignKey
ALTER TABLE "OpenerTransferLog" ADD CONSTRAINT "OpenerTransferLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
