DROP TABLE IF EXISTS "ForthContact";

CREATE TABLE "ForthContact" (
    "id" TEXT NOT NULL,
    "forthId" TEXT NOT NULL,
    "agentId" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "status" TEXT,
    "enrolledAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "enrolledDate" TIMESTAMP(3),
    "submittedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForthContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ForthContact_forthId_key" ON "ForthContact"("forthId");
CREATE INDEX "ForthContact_agentId_submittedDate_idx" ON "ForthContact"("agentId", "submittedDate");
CREATE INDEX "ForthContact_agentId_enrolledDate_idx" ON "ForthContact"("agentId", "enrolledDate");
CREATE INDEX "ForthContact_submittedDate_idx" ON "ForthContact"("submittedDate");
CREATE INDEX "ForthContact_enrolledDate_idx" ON "ForthContact"("enrolledDate");

ALTER TABLE "ForthContact" ADD CONSTRAINT "ForthContact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
