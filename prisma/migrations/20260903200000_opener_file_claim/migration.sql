-- CreateTable
CREATE TABLE IF NOT EXISTS "OpenerFileClaim" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "forthId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "note" TEXT,
    "transferAgentSnapshot" TEXT,
    "enrolledSnapshot" BOOLEAN,
    "status" "FileClaimStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenerFileClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OpenerFileClaim_agentId_status_idx" ON "OpenerFileClaim"("agentId", "status");
CREATE INDEX IF NOT EXISTS "OpenerFileClaim_status_createdAt_idx" ON "OpenerFileClaim"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OpenerFileClaim_forthId_idx" ON "OpenerFileClaim"("forthId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OpenerFileClaim" ADD CONSTRAINT "OpenerFileClaim_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OpenerFileClaim" ADD CONSTRAINT "OpenerFileClaim_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
