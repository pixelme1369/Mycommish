-- Manager out-of-pocket agent bonuses reimbursed on commission pay date.
CREATE TYPE "ManagerBonusStatus" AS ENUM ('owed', 'reimbursed');

CREATE TABLE "ManagerBonusPayout" (
    "id" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "recipientAgentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "status" "ManagerBonusStatus" NOT NULL DEFAULT 'owed',
    "reimbursedAt" TIMESTAMP(3),
    "reimbursedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerBonusPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagerBonusPayout_paidById_status_idx" ON "ManagerBonusPayout"("paidById", "status");
CREATE INDEX "ManagerBonusPayout_periodLabel_status_idx" ON "ManagerBonusPayout"("periodLabel", "status");
CREATE INDEX "ManagerBonusPayout_recipientAgentId_idx" ON "ManagerBonusPayout"("recipientAgentId");

ALTER TABLE "ManagerBonusPayout" ADD CONSTRAINT "ManagerBonusPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerBonusPayout" ADD CONSTRAINT "ManagerBonusPayout_recipientAgentId_fkey" FOREIGN KEY ("recipientAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagerBonusPayout" ADD CONSTRAINT "ManagerBonusPayout_reimbursedById_fkey" FOREIGN KEY ("reimbursedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
