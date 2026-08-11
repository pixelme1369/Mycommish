-- AlterTable
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "suspendedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Agent_suspendedAt_idx" ON "Agent"("suspendedAt");
CREATE INDEX IF NOT EXISTS "Agent_lastLoginAt_idx" ON "Agent"("lastLoginAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Agent_suspendedById_fkey'
  ) THEN
    ALTER TABLE "Agent"
      ADD CONSTRAINT "Agent_suspendedById_fkey"
      FOREIGN KEY ("suspendedById") REFERENCES "Agent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
