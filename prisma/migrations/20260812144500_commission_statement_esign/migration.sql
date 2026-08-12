-- CreateEnum
CREATE TYPE "StatementSignStatus" AS ENUM ('unsigned', 'agent_signed', 'fully_signed');

-- CreateTable
CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL,
    "agentPeriodId" TEXT NOT NULL,
    "status" "StatementSignStatus" NOT NULL DEFAULT 'unsigned',
    "agentTypedName" TEXT,
    "agentSignaturePng" BYTEA,
    "agentSignedAt" TIMESTAMP(3),
    "agentSignedById" TEXT,
    "netAtAgentSign" DECIMAL(14,2),
    "managerTypedName" TEXT,
    "managerSignaturePng" BYTEA,
    "managerSignedAt" TIMESTAMP(3),
    "managerSignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionStatement_agentPeriodId_key" ON "CommissionStatement"("agentPeriodId");

-- CreateIndex
CREATE INDEX "CommissionStatement_status_idx" ON "CommissionStatement"("status");

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_agentPeriodId_fkey" FOREIGN KEY ("agentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_agentSignedById_fkey" FOREIGN KEY ("agentSignedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_managerSignedById_fkey" FOREIGN KEY ("managerSignedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
