-- Statements must survive commission period delete / CRM re-upload (like manager bonuses).
-- Durable identity: periodLabel + agentName. agentPeriodId becomes optional (SetNull).

ALTER TABLE "CommissionStatement" ADD COLUMN "periodLabel" TEXT;
ALTER TABLE "CommissionStatement" ADD COLUMN "agentName" TEXT;

UPDATE "CommissionStatement" AS cs
SET
  "periodLabel" = cp."periodLabel",
  "agentName" = ap."agentName"
FROM "AgentPeriod" AS ap
INNER JOIN "CommissionPeriod" AS cp ON cp."id" = ap."periodId"
WHERE cs."agentPeriodId" = ap."id";

-- Orphans (should not exist under old Cascade) cannot be backfilled — drop them.
DELETE FROM "CommissionStatement"
WHERE "periodLabel" IS NULL OR "agentName" IS NULL OR "periodLabel" = '' OR "agentName" = '';

ALTER TABLE "CommissionStatement" ALTER COLUMN "periodLabel" SET NOT NULL;
ALTER TABLE "CommissionStatement" ALTER COLUMN "agentName" SET NOT NULL;

ALTER TABLE "CommissionStatement" DROP CONSTRAINT "CommissionStatement_agentPeriodId_fkey";
ALTER TABLE "CommissionStatement" ALTER COLUMN "agentPeriodId" DROP NOT NULL;
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_agentPeriodId_fkey"
  FOREIGN KEY ("agentPeriodId") REFERENCES "AgentPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CommissionStatement_periodLabel_agentName_key"
  ON "CommissionStatement"("periodLabel", "agentName");

CREATE INDEX "CommissionStatement_periodLabel_status_idx"
  ON "CommissionStatement"("periodLabel", "status");
