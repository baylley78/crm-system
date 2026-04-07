/*
  Warnings:

  - You are about to drop the column `failReason` on the `SecondSalesOrder` table. All the data in the column will be lost.
  - You are about to drop the column `performanceAmount` on the `SecondSalesOrder` table. All the data in the column will be lost.
  - You are about to drop the column `remark` on the `SecondSalesOrder` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `SecondSalesOrder` table. All the data in the column will be lost.
  - You are about to drop the column `successNote` on the `SecondSalesOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "firstSalesChatRecordUrl" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "leaderUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "approvalId" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "approverId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalStep_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualityRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "customerId" INTEGER,
    "inspectorId" INTEGER,
    "score" DECIMAL DEFAULT 0,
    "result" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QualityRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QualityRecord_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractArchive" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "salesStage" TEXT NOT NULL,
    "relatedOrderId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "signDate" DATETIME NOT NULL,
    "fileUrl" TEXT,
    "contractSpecialistId" INTEGER NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractArchive_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractArchive_contractSpecialistId_fkey" FOREIGN KEY ("contractSpecialistId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Approval" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicantId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "approvalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL DEFAULT 0,
    "leaveDays" DECIMAL DEFAULT 0,
    "punchDate" DATETIME,
    "punchTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" INTEGER,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "maxStep" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Approval_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Approval" ("amount", "applicantId", "approvalType", "approvedAt", "approverId", "createdAt", "customerId", "id", "leaveDays", "reason", "remark", "status", "title", "updatedAt") SELECT "amount", "applicantId", "approvalType", "approvedAt", "approverId", "createdAt", "customerId", "id", "leaveDays", "reason", "remark", "status", "title", "updatedAt" FROM "Approval";
DROP TABLE "Approval";
ALTER TABLE "new_Approval" RENAME TO "Approval";
CREATE TABLE "new_FirstSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "salesUserId" INTEGER NOT NULL,
    "orderType" TEXT NOT NULL,
    "isTimelyDeal" BOOLEAN NOT NULL DEFAULT true,
    "targetAmount" DECIMAL NOT NULL DEFAULT 0,
    "contractAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "evidenceImageUrls" TEXT,
    "paymentStatus" TEXT,
    "financeReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" DATETIME,
    "financeReviewRemark" TEXT,
    "orderDate" DATETIME NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirstSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FirstSalesOrder_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FirstSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FirstSalesOrder" ("arrearsAmount", "contractAmount", "createdAt", "customerId", "id", "orderDate", "orderType", "paymentAmount", "paymentStatus", "remark", "salesUserId", "updatedAt") SELECT "arrearsAmount", "contractAmount", "createdAt", "customerId", "id", "orderDate", "orderType", "paymentAmount", "paymentStatus", "remark", "salesUserId", "updatedAt" FROM "FirstSalesOrder";
DROP TABLE "FirstSalesOrder";
ALTER TABLE "new_FirstSalesOrder" RENAME TO "FirstSalesOrder";
CREATE TABLE "new_Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "customerScope" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "reportScope" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("code", "createdAt", "description", "id", "name", "updatedAt") SELECT "code", "createdAt", "description", "id", "name", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE TABLE "new_SecondSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "secondPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "chatRecordUrl" TEXT,
    "evidenceFileUrls" TEXT,
    "orderDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecondSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SecondSalesAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SecondSalesOrder" ("assignmentId", "createdAt", "customerId", "id", "orderDate", "secondPaymentAmount", "secondSalesUserId", "updatedAt") SELECT "assignmentId", "createdAt", "customerId", "id", "orderDate", "secondPaymentAmount", "secondSalesUserId", "updatedAt" FROM "SecondSalesOrder";
DROP TABLE "SecondSalesOrder";
ALTER TABLE "new_SecondSalesOrder" RENAME TO "SecondSalesOrder";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "departmentId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roleId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "department", "id", "password", "phone", "realName", "roleId", "status", "updatedAt", "username") SELECT "createdAt", "department", "id", "password", "phone", "realName", "roleId", "status", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_approvalId_step_key" ON "ApprovalStep"("approvalId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "ContractArchive_contractNo_key" ON "ContractArchive"("contractNo");
