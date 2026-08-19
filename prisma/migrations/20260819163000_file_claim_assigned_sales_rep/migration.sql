-- Persist Sales Rep assignment on accepted file claims so CRM re-uploads keep it.
ALTER TABLE "FileClaim" ADD COLUMN "assignedSalesRep" TEXT;
