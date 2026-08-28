-- CreateEnum
CREATE TYPE "DailyFollowUpDay" AS ENUM ('day3', 'day10');

-- CreateTable
CREATE TABLE "DailyTaskCompletion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "followUp" "DailyFollowUpDay" NOT NULL,
    "enrolledYmd" TEXT NOT NULL,
    "emailDone" BOOLEAN NOT NULL DEFAULT false,
    "smsDone" BOOLEAN NOT NULL DEFAULT false,
    "callDone" BOOLEAN NOT NULL DEFAULT false,
    "emailDoneAt" TIMESTAMP(3),
    "smsDoneAt" TIMESTAMP(3),
    "callDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTaskCompletion_agentId_followUp_idx" ON "DailyTaskCompletion"("agentId", "followUp");

-- CreateIndex
CREATE INDEX "DailyTaskCompletion_crmId_idx" ON "DailyTaskCompletion"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTaskCompletion_agentId_crmId_followUp_enrolledYmd_key" ON "DailyTaskCompletion"("agentId", "crmId", "followUp", "enrolledYmd");

-- AddForeignKey
ALTER TABLE "DailyTaskCompletion" ADD CONSTRAINT "DailyTaskCompletion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTaskCompletion" ADD CONSTRAINT "DailyTaskCompletion_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "ClientIdentity"("crmId") ON DELETE CASCADE ON UPDATE CASCADE;
