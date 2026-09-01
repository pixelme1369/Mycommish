-- CreateEnum
CREATE TYPE "AgentDocumentSignStatus" AS ENUM ('pending', 'signed');

-- CreateTable
CREATE TABLE "AgentDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "pdfBytes" BYTEA NOT NULL,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDocumentSignature" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AgentDocumentSignStatus" NOT NULL DEFAULT 'pending',
    "typedName" TEXT,
    "signaturePng" BYTEA,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentDocument_sentAt_idx" ON "AgentDocument"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDocumentSignature_documentId_agentId_key" ON "AgentDocumentSignature"("documentId", "agentId");

-- CreateIndex
CREATE INDEX "AgentDocumentSignature_agentId_status_idx" ON "AgentDocumentSignature"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentDocumentSignature_signedAt_idx" ON "AgentDocumentSignature"("signedAt");

-- AddForeignKey
ALTER TABLE "AgentDocument" ADD CONSTRAINT "AgentDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDocumentSignature" ADD CONSTRAINT "AgentDocumentSignature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AgentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDocumentSignature" ADD CONSTRAINT "AgentDocumentSignature_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
