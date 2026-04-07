-- CreateEnum
CREATE TYPE "LegalCaseStage" AS ENUM ('ASSISTANT', 'FILING_SPECIALIST', 'PRE_TRIAL', 'CLOSED');

-- AlterTable
ALTER TABLE "LegalCase" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "archiveCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archiveNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assistantCollected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assistantDocumented" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assistantTransferredAt" TIMESTAMP(3),
ADD COLUMN     "assistantUserId" INTEGER,
ADD COLUMN     "closeResult" TEXT,
ADD COLUMN     "filingApprovedAt" TIMESTAMP(3),
ADD COLUMN     "filingReviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "filingSpecialistUserId" INTEGER,
ADD COLUMN     "preTrialTransferredAt" TIMESTAMP(3),
ADD COLUMN     "preTrialUserId" INTEGER,
ADD COLUMN     "stage" "LegalCaseStage" NOT NULL DEFAULT 'ASSISTANT',
ADD COLUMN     "transferredToPreTrial" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "LegalCase_assistantUserId_idx" ON "LegalCase"("assistantUserId");

-- CreateIndex
CREATE INDEX "LegalCase_filingSpecialistUserId_idx" ON "LegalCase"("filingSpecialistUserId");

-- CreateIndex
CREATE INDEX "LegalCase_preTrialUserId_idx" ON "LegalCase"("preTrialUserId");

-- CreateIndex
CREATE INDEX "LegalCase_stage_idx" ON "LegalCase"("stage");

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_assistantUserId_fkey" FOREIGN KEY ("assistantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_filingSpecialistUserId_fkey" FOREIGN KEY ("filingSpecialistUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_preTrialUserId_fkey" FOREIGN KEY ("preTrialUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
