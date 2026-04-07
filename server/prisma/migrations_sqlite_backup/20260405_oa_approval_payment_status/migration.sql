-- Add reimbursement payment tracking fields
ALTER TABLE "Approval" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Approval" ADD COLUMN "paidById" INTEGER;
ALTER TABLE "Approval" ADD COLUMN "paidAt" DATETIME;
