-- AlterTable
ALTER TABLE "JudicialComplaintCase" ADD COLUMN     "qualityChecked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualityCheckedAt" TIMESTAMP(3),
ADD COLUMN     "qualityRecordId" INTEGER;

-- AlterTable
ALTER TABLE "RefundCase" ADD COLUMN     "firstSalesDepartmentId" INTEGER,
ADD COLUMN     "firstSalesDepartmentName" TEXT,
ADD COLUMN     "firstSalesTeamName" TEXT;

-- CreateIndex
CREATE INDEX "JudicialComplaintCase_customerId_idx" ON "JudicialComplaintCase"("customerId");

-- CreateIndex
CREATE INDEX "JudicialComplaintCase_qualityRecordId_idx" ON "JudicialComplaintCase"("qualityRecordId");

-- CreateIndex
CREATE INDEX "QualityRecord_customerId_idx" ON "QualityRecord"("customerId");

-- CreateIndex
CREATE INDEX "RefundCase_firstSalesDepartmentId_idx" ON "RefundCase"("firstSalesDepartmentId");

-- CreateIndex
CREATE INDEX "RefundCase_firstSalesTeamName_idx" ON "RefundCase"("firstSalesTeamName");

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_firstSalesDepartmentId_fkey" FOREIGN KEY ("firstSalesDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialComplaintCase" ADD CONSTRAINT "JudicialComplaintCase_qualityRecordId_fkey" FOREIGN KEY ("qualityRecordId") REFERENCES "QualityRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
