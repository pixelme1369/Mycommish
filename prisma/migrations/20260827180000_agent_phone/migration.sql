-- Agent mobile for outreach / contact (self-serve from portal).
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;
