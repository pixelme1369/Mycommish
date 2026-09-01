-- AlterTable
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "forthCreatedAt" TIMESTAMP(3);
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "timeInStatus" TEXT;
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "cordobaEnrolledYmd" TEXT;
ALTER TABLE "ForthContact" ADD COLUMN IF NOT EXISTS "cordobaDroppedYmd" TEXT;
