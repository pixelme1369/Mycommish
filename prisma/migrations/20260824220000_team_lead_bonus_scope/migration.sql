-- Team-lead bonus scope: roster members vs all period units cleared.

DO $$ BEGIN
  CREATE TYPE "TeamLeadBonusScope" AS ENUM ('roster', 'all_period_units');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TeamLead"
  ADD COLUMN IF NOT EXISTS "bonusScope" "TeamLeadBonusScope" NOT NULL DEFAULT 'roster';
