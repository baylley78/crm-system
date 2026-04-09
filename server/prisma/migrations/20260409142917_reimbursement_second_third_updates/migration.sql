-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "reimbursementAccountName" TEXT,
ADD COLUMN     "reimbursementBankName" TEXT,
ADD COLUMN     "reimbursementCardNo" TEXT,
ADD COLUMN     "reimbursementPayeeName" TEXT,
ADD COLUMN     "reimbursementVoucherUrl" TEXT;

-- AlterTable
ALTER TABLE "SecondSalesOrder" ADD COLUMN     "arrearsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "contractAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "orderType" "FirstOrderType" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "paymentStatus" TEXT;

-- AlterTable
ALTER TABLE "ThirdSalesOrder" ADD COLUMN     "arrearsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "chatRecordUrl" TEXT,
ADD COLUMN     "contractAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "orderType" "FirstOrderType" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "paymentStatus" TEXT;
