-- CreateIndex
CREATE UNIQUE INDEX "FirstSalesOrder_paymentSerialNo_key" ON "FirstSalesOrder"("paymentSerialNo");

-- CreateIndex
CREATE UNIQUE INDEX "SecondSalesOrder_paymentSerialNo_key" ON "SecondSalesOrder"("paymentSerialNo");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdSalesOrder_paymentSerialNo_key" ON "ThirdSalesOrder"("paymentSerialNo");
