-- CreateEnum
CREATE TYPE "FileClaimStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "FileClaim" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "note" TEXT,
    "status" "FileClaimStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileClaim_agentId_status_idx" ON "FileClaim"("agentId", "status");

-- CreateIndex
CREATE INDEX "FileClaim_status_createdAt_idx" ON "FileClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FileClaim_crmId_idx" ON "FileClaim"("crmId");

-- AddForeignKey
ALTER TABLE "FileClaim" ADD CONSTRAINT "FileClaim_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileClaim" ADD CONSTRAINT "FileClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
