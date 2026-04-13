-- CreateTable
CREATE TABLE "InvalidLead" (
    "id" SERIAL NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvalidLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvalidLead_reportDate_idx" ON "InvalidLead"("reportDate");

-- CreateIndex
CREATE INDEX "InvalidLead_departmentId_idx" ON "InvalidLead"("departmentId");

-- CreateIndex
CREATE INDEX "InvalidLead_userId_idx" ON "InvalidLead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InvalidLead_reportDate_userId_phone_key" ON "InvalidLead"("reportDate", "userId", "phone");

-- AddForeignKey
ALTER TABLE "InvalidLead" ADD CONSTRAINT "InvalidLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvalidLead" ADD CONSTRAINT "InvalidLead_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
