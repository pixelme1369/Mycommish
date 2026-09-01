-- CreateTable
CREATE TABLE "PortalGoalSettings" (
    "id" TEXT NOT NULL,
    "clearRatePct" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalGoalSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PortalGoalSettings" ("id", "clearRatePct", "updatedAt")
VALUES ('default', 70, CURRENT_TIMESTAMP);
