-- AlterTable
ALTER TABLE "RefundCase" ADD COLUMN     "firstSalesUserId" INTEGER,
ADD COLUMN     "firstSalesUserName" TEXT;

-- CreateIndex
CREATE INDEX "RefundCase_firstSalesUserId_idx" ON "RefundCase"("firstSalesUserId");
