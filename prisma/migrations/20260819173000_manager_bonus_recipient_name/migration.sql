-- Allow freehand recipient names when the agent is not in the Users list.
ALTER TABLE "ManagerBonusPayout" ADD COLUMN "recipientName" TEXT;

UPDATE "ManagerBonusPayout" mb
SET "recipientName" = a."displayName"
FROM "Agent" a
WHERE a."id" = mb."recipientAgentId";

UPDATE "ManagerBonusPayout" SET "recipientName" = 'Unknown' WHERE "recipientName" IS NULL OR "recipientName" = '';

ALTER TABLE "ManagerBonusPayout" ALTER COLUMN "recipientName" SET NOT NULL;

ALTER TABLE "ManagerBonusPayout" DROP CONSTRAINT "ManagerBonusPayout_recipientAgentId_fkey";
ALTER TABLE "ManagerBonusPayout" ALTER COLUMN "recipientAgentId" DROP NOT NULL;
ALTER TABLE "ManagerBonusPayout" ADD CONSTRAINT "ManagerBonusPayout_recipientAgentId_fkey" FOREIGN KEY ("recipientAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
