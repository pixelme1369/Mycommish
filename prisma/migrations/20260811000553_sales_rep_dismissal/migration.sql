-- CreateTable
CREATE TABLE "SalesRepDismissal" (
    "id" TEXT NOT NULL,
    "agentNameKey" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRepDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesRepDismissal_agentNameKey_key" ON "SalesRepDismissal"("agentNameKey");
