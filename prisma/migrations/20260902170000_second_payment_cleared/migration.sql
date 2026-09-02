-- AlterTable
ALTER TABLE "ClientIdentity" ADD COLUMN "secondPaymentClearedDate" TEXT;
ALTER TABLE "ClientIdentity" ADD COLUMN "paymentsMade" INTEGER;

-- AlterTable
ALTER TABLE "ClientEvent" ADD COLUMN "secondPaymentClearedDate" TEXT;
