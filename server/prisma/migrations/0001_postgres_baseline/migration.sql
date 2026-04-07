-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('INITIAL', 'PENDING_TAIL_PAYMENT', 'PENDING_SECOND_SALES_ASSIGNMENT', 'SECOND_SALES_FOLLOWING', 'PENDING_LEGAL', 'LEGAL_PROCESSING', 'PENDING_MEDIATION', 'PENDING_THIRD_SALES', 'THIRD_SALES_FOLLOWING', 'COMPLETED_THIRD_SALES', 'MEDIATION_PROCESSING', 'MEDIATION_COMPLETED');

-- CreateEnum
CREATE TYPE "FirstOrderType" AS ENUM ('DEPOSIT', 'TAIL', 'FULL');

-- CreateEnum
CREATE TYPE "FinanceReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FollowStage" AS ENUM ('FIRST_SALES', 'SECOND_SALES', 'LEGAL', 'THIRD_SALES', 'MEDIATION');

-- CreateEnum
CREATE TYPE "SecondSalesResult" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('REIMBURSEMENT', 'LEAVE', 'PUNCH_CARD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReimbursementPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ContractSalesStage" AS ENUM ('FIRST', 'SECOND', 'THIRD');

-- CreateEnum
CREATE TYPE "RefundSourceStage" AS ENUM ('FIRST_SALES', 'SECOND_SALES', 'LEGAL', 'MEDIATION', 'THIRD_SALES', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_ASSIGNMENT', 'PROCESSING', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RefundAction" AS ENUM ('CREATE', 'REVIEW_APPROVE', 'REVIEW_REJECT', 'ASSIGN', 'FOLLOW', 'CLOSE');

-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('SELF', 'DEPARTMENT', 'DEPARTMENT_AND_CHILDREN', 'ALL');

-- CreateEnum
CREATE TYPE "JudicialComplaintHandlingStatus" AS ENUM ('PENDING', 'PROCESSING', 'HANDLED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ThirdSalesSourceStage" AS ENUM ('SECOND_SALES', 'LEGAL');

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "leaderUserId" INTEGER,
    "hrUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "customerScope" "DataScope" NOT NULL DEFAULT 'DEPARTMENT',
    "reportScope" "DataScope" NOT NULL DEFAULT 'DEPARTMENT',
    "userManageScope" "DataScope" NOT NULL DEFAULT 'SELF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "roleId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("roleId","userId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "departmentId" INTEGER,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "customerNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wechat" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "province" TEXT,
    "city" TEXT,
    "source" TEXT,
    "caseType" TEXT,
    "intentionLevel" TEXT,
    "currentStatus" "CustomerStatus" NOT NULL DEFAULT 'INITIAL',
    "currentOwnerId" INTEGER,
    "firstSalesUserId" INTEGER,
    "secondSalesUserId" INTEGER,
    "legalUserId" INTEGER,
    "thirdSalesUserId" INTEGER,
    "thirdSalesSourceStage" "ThirdSalesSourceStage",
    "targetAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "firstPaymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "secondPaymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "thirdPaymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPaymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isTailPaymentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstSalesChatRecordUrl" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFollowLog" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "stage" "FollowStage" NOT NULL,
    "content" TEXT NOT NULL,
    "nextFollowTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFollowLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstSalesOrder" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "salesUserId" INTEGER NOT NULL,
    "orderType" "FirstOrderType" NOT NULL,
    "isTimelyDeal" BOOLEAN NOT NULL DEFAULT true,
    "targetAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "contractAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "evidenceImageUrls" TEXT,
    "paymentStatus" TEXT,
    "financeReviewStatus" "FinanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" TIMESTAMP(3),
    "financeReviewRemark" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirstSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondSalesAssignment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondSalesAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondSalesOrder" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "secondPaymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "includesHearing" BOOLEAN NOT NULL DEFAULT false,
    "hearingCostAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "performanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "chatRecordUrl" TEXT,
    "evidenceFileUrls" TEXT,
    "remark" TEXT,
    "financeReviewStatus" "FinanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" TIMESTAMP(3),
    "financeReviewRemark" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediationCase" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressStatus" TEXT NOT NULL,
    "mediationResult" TEXT,
    "finishDate" TIMESTAMP(3),
    "remark" TEXT,
    "evidenceFileUrls" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "legalUserId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressStatus" TEXT NOT NULL,
    "caseResult" TEXT,
    "filingApproved" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundCase" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "sourceStage" "RefundSourceStage" NOT NULL,
    "relatedOrderId" INTEGER,
    "relatedOrderStage" "ContractSalesStage",
    "requestedById" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "assigneeId" INTEGER,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" TEXT NOT NULL,
    "expectedRefundAmount" DECIMAL(65,30) DEFAULT 0,
    "remark" TEXT,
    "reviewRemark" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundCaseLog" (
    "id" SERIAL NOT NULL,
    "refundCaseId" INTEGER NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "action" "RefundAction" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundCaseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudicialComplaintCase" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "submittedById" INTEGER NOT NULL,
    "handledById" INTEGER,
    "complaintSubject" TEXT NOT NULL,
    "teamName" TEXT,
    "departmentName" TEXT,
    "complaintTime" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationToCustomer" TEXT,
    "firstSignTime" TIMESTAMP(3),
    "secondSignTime" TIMESTAMP(3),
    "firstDealAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "secondDealAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "firstSalesName" TEXT,
    "secondSalesName" TEXT,
    "legalAssistantName" TEXT,
    "summary" TEXT,
    "complaintReason" TEXT NOT NULL,
    "progress" TEXT,
    "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "intervenedBeforeComplaint" BOOLEAN NOT NULL DEFAULT false,
    "suddenRefundRequest" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyGuidance" BOOLEAN NOT NULL DEFAULT false,
    "shouldHandle" BOOLEAN NOT NULL DEFAULT true,
    "handlingStatus" "JudicialComplaintHandlingStatus" NOT NULL DEFAULT 'PENDING',
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudicialComplaintCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdSalesOrder" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "thirdSalesUserId" INTEGER NOT NULL,
    "sourceStage" "ThirdSalesSourceStage",
    "productName" TEXT NOT NULL,
    "paymentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rawPerformanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "hearingCostAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "performanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "financeReviewStatus" "FinanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" TIMESTAMP(3),
    "financeReviewRemark" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "remark" TEXT,
    "evidenceFileUrls" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" SERIAL NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNo" TEXT NOT NULL,
    "remark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtConfig" (
    "id" SERIAL NOT NULL,
    "hearingCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DingTalkReportConfig" (
    "id" SERIAL NOT NULL,
    "templateType" TEXT NOT NULL,
    "departmentIds" TEXT NOT NULL,
    "departmentNames" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "dailyTarget" TEXT,
    "messageTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DingTalkReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" SERIAL NOT NULL,
    "applicantId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "approvalType" "ApprovalType" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(65,30) DEFAULT 0,
    "leaveDays" DECIMAL(65,30) DEFAULT 0,
    "punchDate" TIMESTAMP(3),
    "punchTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "ReimbursementPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "approverId" INTEGER,
    "paidById" INTEGER,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "maxStep" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" SERIAL NOT NULL,
    "approvalId" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "approverId" INTEGER NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityRecord" (
    "id" SERIAL NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "responsibleId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "matter" TEXT NOT NULL,
    "penaltyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractArchive" (
    "id" SERIAL NOT NULL,
    "contractNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "salesStage" "ContractSalesStage" NOT NULL,
    "relatedOrderId" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "signDate" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,
    "contractSpecialistId" INTEGER NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_parentId_key" ON "Department"("name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNo_key" ON "Customer"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "FirstSalesOrder_paymentSerialNo_key" ON "FirstSalesOrder"("paymentSerialNo");

-- CreateIndex
CREATE UNIQUE INDEX "SecondSalesOrder_paymentSerialNo_key" ON "SecondSalesOrder"("paymentSerialNo");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdSalesOrder_paymentSerialNo_key" ON "ThirdSalesOrder"("paymentSerialNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_approvalId_step_key" ON "ApprovalStep"("approvalId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "ContractArchive_contractNo_key" ON "ContractArchive"("contractNo");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_hrUserId_fkey" FOREIGN KEY ("hrUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_firstSalesUserId_fkey" FOREIGN KEY ("firstSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_legalUserId_fkey" FOREIGN KEY ("legalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowLog" ADD CONSTRAINT "CustomerFollowLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowLog" ADD CONSTRAINT "CustomerFollowLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstSalesOrder" ADD CONSTRAINT "FirstSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstSalesOrder" ADD CONSTRAINT "FirstSalesOrder_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstSalesOrder" ADD CONSTRAINT "FirstSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstSalesOrder" ADD CONSTRAINT "FirstSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesAssignment" ADD CONSTRAINT "SecondSalesAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesAssignment" ADD CONSTRAINT "SecondSalesAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesAssignment" ADD CONSTRAINT "SecondSalesAssignment_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesOrder" ADD CONSTRAINT "SecondSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesOrder" ADD CONSTRAINT "SecondSalesOrder_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesOrder" ADD CONSTRAINT "SecondSalesOrder_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SecondSalesAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesOrder" ADD CONSTRAINT "SecondSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSalesOrder" ADD CONSTRAINT "SecondSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediationCase" ADD CONSTRAINT "MediationCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediationCase" ADD CONSTRAINT "MediationCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_legalUserId_fkey" FOREIGN KEY ("legalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCaseLog" ADD CONSTRAINT "RefundCaseLog_refundCaseId_fkey" FOREIGN KEY ("refundCaseId") REFERENCES "RefundCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCaseLog" ADD CONSTRAINT "RefundCaseLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialComplaintCase" ADD CONSTRAINT "JudicialComplaintCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialComplaintCase" ADD CONSTRAINT "JudicialComplaintCase_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialComplaintCase" ADD CONSTRAINT "JudicialComplaintCase_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdSalesOrder" ADD CONSTRAINT "ThirdSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdSalesOrder" ADD CONSTRAINT "ThirdSalesOrder_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdSalesOrder" ADD CONSTRAINT "ThirdSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdSalesOrder" ADD CONSTRAINT "ThirdSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRecord" ADD CONSTRAINT "QualityRecord_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRecord" ADD CONSTRAINT "QualityRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractArchive" ADD CONSTRAINT "ContractArchive_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractArchive" ADD CONSTRAINT "ContractArchive_contractSpecialistId_fkey" FOREIGN KEY ("contractSpecialistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

