-- CreateTable
CREATE TABLE "AgentMonthlyGoal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "unitsGoal" INTEGER NOT NULL,
    "debtGoal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMonthlyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForthContact" (
    "id" TEXT NOT NULL,
    "forthContactId" TEXT NOT NULL,
    "agentName" TEXT,
    "status" TEXT,
    "subStatus" TEXT,
    "carrier" TEXT,
    "policyType" TEXT,
    "benefitType" TEXT,
    "caseNumber" TEXT,
    "policyNumber" TEXT,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "relationship" TEXT,
    "enrollmentMethod" TEXT,
    "creationYmd" TEXT,
    "submittedYmd" TEXT,
    "issuedYmd" TEXT,
    "startYmd" TEXT,
    "enrolledYmd" TEXT,
    "benefit" TEXT,
    "annualPremium" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyPremium" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "modalPremium" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mode" TEXT,
    "source" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdDateYmd" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForthContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMonthlyGoal_agentId_monthLabel_key" ON "AgentMonthlyGoal"("agentId", "monthLabel");

-- CreateIndex
CREATE INDEX "AgentMonthlyGoal_monthLabel_idx" ON "AgentMonthlyGoal"("monthLabel");

-- CreateIndex
CREATE UNIQUE INDEX "ForthContact_forthContactId_key" ON "ForthContact"("forthContactId");

-- CreateIndex
CREATE INDEX "ForthContact_agentName_submittedYmd_idx" ON "ForthContact"("agentName", "submittedYmd");

-- CreateIndex
CREATE INDEX "ForthContact_agentName_enrolledYmd_idx" ON "ForthContact"("agentName", "enrolledYmd");

-- CreateIndex
CREATE INDEX "ForthContact_submittedYmd_idx" ON "ForthContact"("submittedYmd");

-- CreateIndex
CREATE INDEX "ForthContact_enrolledYmd_idx" ON "ForthContact"("enrolledYmd");

-- AddForeignKey
ALTER TABLE "AgentMonthlyGoal" ADD CONSTRAINT "AgentMonthlyGoal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
