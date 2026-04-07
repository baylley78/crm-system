-- CreateIndex
CREATE INDEX "Customer_currentStatus_idx" ON "Customer"("currentStatus");

-- CreateIndex
CREATE INDEX "Customer_currentOwnerId_idx" ON "Customer"("currentOwnerId");

-- CreateIndex
CREATE INDEX "Customer_firstSalesUserId_idx" ON "Customer"("firstSalesUserId");

-- CreateIndex
CREATE INDEX "Customer_secondSalesUserId_idx" ON "Customer"("secondSalesUserId");

-- CreateIndex
CREATE INDEX "Customer_legalUserId_idx" ON "Customer"("legalUserId");

-- CreateIndex
CREATE INDEX "Customer_thirdSalesUserId_idx" ON "Customer"("thirdSalesUserId");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_updatedAt_idx" ON "Customer"("updatedAt");

-- CreateIndex
CREATE INDEX "CustomerFollowLog_customerId_idx" ON "CustomerFollowLog"("customerId");

-- CreateIndex
CREATE INDEX "CustomerFollowLog_operatorId_idx" ON "CustomerFollowLog"("operatorId");

-- CreateIndex
CREATE INDEX "CustomerFollowLog_createdAt_idx" ON "CustomerFollowLog"("createdAt");

-- CreateIndex
CREATE INDEX "FirstSalesOrder_customerId_idx" ON "FirstSalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "FirstSalesOrder_salesUserId_idx" ON "FirstSalesOrder"("salesUserId");

-- CreateIndex
CREATE INDEX "FirstSalesOrder_orderDate_idx" ON "FirstSalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "FirstSalesOrder_createdAt_idx" ON "FirstSalesOrder"("createdAt");

-- CreateIndex
CREATE INDEX "FirstSalesOrder_financeReviewStatus_idx" ON "FirstSalesOrder"("financeReviewStatus");

-- CreateIndex
CREATE INDEX "LegalCase_customerId_idx" ON "LegalCase"("customerId");

-- CreateIndex
CREATE INDEX "LegalCase_legalUserId_idx" ON "LegalCase"("legalUserId");

-- CreateIndex
CREATE INDEX "LegalCase_createdAt_idx" ON "LegalCase"("createdAt");

-- CreateIndex
CREATE INDEX "MediationCase_customerId_idx" ON "MediationCase"("customerId");

-- CreateIndex
CREATE INDEX "MediationCase_ownerId_idx" ON "MediationCase"("ownerId");

-- CreateIndex
CREATE INDEX "MediationCase_createdAt_idx" ON "MediationCase"("createdAt");

-- CreateIndex
CREATE INDEX "RefundCase_customerId_idx" ON "RefundCase"("customerId");

-- CreateIndex
CREATE INDEX "RefundCase_status_idx" ON "RefundCase"("status");

-- CreateIndex
CREATE INDEX "RefundCase_createdAt_idx" ON "RefundCase"("createdAt");

-- CreateIndex
CREATE INDEX "SecondSalesAssignment_customerId_idx" ON "SecondSalesAssignment"("customerId");

-- CreateIndex
CREATE INDEX "SecondSalesAssignment_secondSalesUserId_idx" ON "SecondSalesAssignment"("secondSalesUserId");

-- CreateIndex
CREATE INDEX "SecondSalesAssignment_assignedAt_idx" ON "SecondSalesAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "SecondSalesAssignment_status_idx" ON "SecondSalesAssignment"("status");

-- CreateIndex
CREATE INDEX "SecondSalesOrder_customerId_idx" ON "SecondSalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SecondSalesOrder_secondSalesUserId_idx" ON "SecondSalesOrder"("secondSalesUserId");

-- CreateIndex
CREATE INDEX "SecondSalesOrder_orderDate_idx" ON "SecondSalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "SecondSalesOrder_createdAt_idx" ON "SecondSalesOrder"("createdAt");

-- CreateIndex
CREATE INDEX "SecondSalesOrder_financeReviewStatus_idx" ON "SecondSalesOrder"("financeReviewStatus");

-- CreateIndex
CREATE INDEX "ThirdSalesOrder_customerId_idx" ON "ThirdSalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "ThirdSalesOrder_thirdSalesUserId_idx" ON "ThirdSalesOrder"("thirdSalesUserId");

-- CreateIndex
CREATE INDEX "ThirdSalesOrder_orderDate_idx" ON "ThirdSalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "ThirdSalesOrder_createdAt_idx" ON "ThirdSalesOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ThirdSalesOrder_financeReviewStatus_idx" ON "ThirdSalesOrder"("financeReviewStatus");
