-- AlterTable
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "transferAgentId" TEXT;
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "transferAgent" TEXT;
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "transferredDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForthContact_transferAgentId_idx" ON "ForthContact"("transferAgentId");
CREATE INDEX IF NOT EXISTS "ForthContact_transferAgent_idx" ON "ForthContact"("transferAgent");
CREATE INDEX IF NOT EXISTS "ForthContact_transferredDate_idx" ON "ForthContact"("transferredDate");
