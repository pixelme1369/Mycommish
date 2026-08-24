-- Gusto legal name + employee id on Agent (editable under Users).
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "gustoFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "gustoLastName" TEXT,
  ADD COLUMN IF NOT EXISTS "gustoEmployeeId" TEXT;
