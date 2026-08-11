-- AlterTable
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "salesRep" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "crmStatus" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "enrolledDate" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "firstPaymentClearedDate" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN IF NOT EXISTS "droppedDate" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientIdentity_externalId_idx" ON "ClientIdentity"("externalId");
CREATE INDEX IF NOT EXISTS "ClientIdentity_clientName_idx" ON "ClientIdentity"("clientName");
CREATE INDEX IF NOT EXISTS "ClientIdentity_salesRep_idx" ON "ClientIdentity"("salesRep");
