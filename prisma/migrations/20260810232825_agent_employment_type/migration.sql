-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('employee', 'contractor');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'employee';
