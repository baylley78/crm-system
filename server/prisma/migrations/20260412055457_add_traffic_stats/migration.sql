-- AlterEnum
ALTER TYPE "LegalCaseStage" ADD VALUE 'PENDING_ASSIGNMENT';

-- AlterTable
ALTER TABLE "LegalCase" ADD COLUMN     "assistantCustomerSituationRemark" TEXT,
ADD COLUMN     "assistantFollowRemark" TEXT,
ADD COLUMN     "filingCustomerSituationRemark" TEXT,
ADD COLUMN     "filingFollowRemark" TEXT,
ADD COLUMN     "preTrialCustomerSituationRemark" TEXT,
ADD COLUMN     "preTrialFollowRemark" TEXT,
ALTER COLUMN "stage" SET DEFAULT 'PENDING_ASSIGNMENT';

-- CreateTable
CREATE TABLE "TrafficStat" (
    "id" SERIAL NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "receptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrafficStat_reportDate_idx" ON "TrafficStat"("reportDate");

-- CreateIndex
CREATE INDEX "TrafficStat_departmentId_idx" ON "TrafficStat"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficStat_reportDate_userId_key" ON "TrafficStat"("reportDate", "userId");

-- AddForeignKey
ALTER TABLE "TrafficStat" ADD CONSTRAINT "TrafficStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficStat" ADD CONSTRAINT "TrafficStat_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
