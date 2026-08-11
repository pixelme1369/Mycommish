-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('admin', 'manager', 'agent');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "role" "AgentRole" NOT NULL DEFAULT 'agent';

-- Backfill from legacy isAdmin flag
UPDATE "Agent" SET "role" = 'admin' WHERE "isAdmin" = true;
