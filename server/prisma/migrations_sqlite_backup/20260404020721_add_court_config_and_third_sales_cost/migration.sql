-- AlterTable
ALTER TABLE "MediationCase" ADD COLUMN "evidenceFileUrls" TEXT;

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNo" TEXT NOT NULL,
    "remark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CourtConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hearingCost" DECIMAL NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "currentStatus" TEXT NOT NULL DEFAULT 'INITIAL',
    "currentOwnerId" INTEGER,
    "firstSalesUserId" INTEGER,
    "secondSalesUserId" INTEGER,
    "legalUserId" INTEGER,
    "thirdSalesUserId" INTEGER,
    "targetAmount" DECIMAL NOT NULL DEFAULT 0,
    "firstPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "secondPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "thirdPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL NOT NULL DEFAULT 0,
    "isTailPaymentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstSalesChatRecordUrl" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_firstSalesUserId_fkey" FOREIGN KEY ("firstSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_legalUserId_fkey" FOREIGN KEY ("legalUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("age", "arrearsAmount", "caseType", "city", "createdAt", "currentOwnerId", "currentStatus", "customerNo", "firstPaymentAmount", "firstSalesChatRecordUrl", "firstSalesUserId", "gender", "id", "intentionLevel", "isTailPaymentCompleted", "legalUserId", "name", "phone", "province", "remark", "secondPaymentAmount", "secondSalesUserId", "source", "thirdPaymentAmount", "thirdSalesUserId", "totalPaymentAmount", "updatedAt", "wechat") SELECT "age", "arrearsAmount", "caseType", "city", "createdAt", "currentOwnerId", "currentStatus", "customerNo", "firstPaymentAmount", "firstSalesChatRecordUrl", "firstSalesUserId", "gender", "id", "intentionLevel", "isTailPaymentCompleted", "legalUserId", "name", "phone", "province", "remark", "secondPaymentAmount", "secondSalesUserId", "source", "thirdPaymentAmount", "thirdSalesUserId", "totalPaymentAmount", "updatedAt", "wechat" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_customerNo_key" ON "Customer"("customerNo");
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE TABLE "new_Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "leaderUserId" INTEGER,
    "hrUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_hrUserId_fkey" FOREIGN KEY ("hrUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Department" ("createdAt", "id", "leaderUserId", "name", "parentId", "sort", "updatedAt") SELECT "createdAt", "id", "leaderUserId", "name", "parentId", "sort", "updatedAt" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_name_parentId_key" ON "Department"("name", "parentId");
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
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
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
    CONSTRAINT "FirstSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FirstSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FirstSalesOrder" ("arrearsAmount", "contractAmount", "createdAt", "customerId", "evidenceImageUrls", "financeReviewRemark", "financeReviewStatus", "financeReviewedAt", "financeReviewerId", "id", "isTimelyDeal", "orderDate", "orderType", "paymentAmount", "paymentScreenshotUrl", "paymentSerialNo", "paymentStatus", "remark", "salesUserId", "targetAmount", "updatedAt") SELECT "arrearsAmount", "contractAmount", "createdAt", "customerId", "evidenceImageUrls", "financeReviewRemark", "financeReviewStatus", "financeReviewedAt", "financeReviewerId", "id", "isTimelyDeal", "orderDate", "orderType", "paymentAmount", "paymentScreenshotUrl", "paymentSerialNo", "paymentStatus", "remark", "salesUserId", "targetAmount", "updatedAt" FROM "FirstSalesOrder";
DROP TABLE "FirstSalesOrder";
ALTER TABLE "new_FirstSalesOrder" RENAME TO "FirstSalesOrder";
CREATE TABLE "new_Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "customerScope" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "reportScope" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "userManageScope" TEXT NOT NULL DEFAULT 'SELF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("code", "createdAt", "customerScope", "description", "id", "name", "reportScope", "updatedAt") SELECT "code", "createdAt", "customerScope", "description", "id", "name", "reportScope", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE TABLE "new_SecondSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "secondPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "chatRecordUrl" TEXT,
    "evidenceFileUrls" TEXT,
    "financeReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" DATETIME,
    "financeReviewRemark" TEXT,
    "orderDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecondSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SecondSalesAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SecondSalesOrder" ("assignmentId", "chatRecordUrl", "createdAt", "customerId", "evidenceFileUrls", "id", "orderDate", "paymentScreenshotUrl", "paymentSerialNo", "secondPaymentAmount", "secondSalesUserId", "updatedAt") SELECT "assignmentId", "chatRecordUrl", "createdAt", "customerId", "evidenceFileUrls", "id", "orderDate", "paymentScreenshotUrl", "paymentSerialNo", "secondPaymentAmount", "secondSalesUserId", "updatedAt" FROM "SecondSalesOrder";
DROP TABLE "SecondSalesOrder";
ALTER TABLE "new_SecondSalesOrder" RENAME TO "SecondSalesOrder";
CREATE TABLE "new_ThirdSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "thirdSalesUserId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "paymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "rawPerformanceAmount" DECIMAL NOT NULL DEFAULT 0,
    "hearingCostAmount" DECIMAL NOT NULL DEFAULT 0,
    "performanceAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentAccountId" INTEGER,
    "paymentAccountName" TEXT,
    "paymentSerialNo" TEXT,
    "paymentScreenshotUrl" TEXT,
    "financeReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "financeReviewerId" INTEGER,
    "financeReviewedAt" DATETIME,
    "financeReviewRemark" TEXT,
    "orderDate" DATETIME NOT NULL,
    "remark" TEXT,
    "evidenceFileUrls" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThirdSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThirdSalesOrder_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThirdSalesOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThirdSalesOrder_financeReviewerId_fkey" FOREIGN KEY ("financeReviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThirdSalesOrder" ("createdAt", "customerId", "id", "orderDate", "paymentAmount", "performanceAmount", "productName", "remark", "thirdSalesUserId", "updatedAt") SELECT "createdAt", "customerId", "id", "orderDate", "paymentAmount", "performanceAmount", "productName", "remark", "thirdSalesUserId", "updatedAt" FROM "ThirdSalesOrder";
DROP TABLE "ThirdSalesOrder";
ALTER TABLE "new_ThirdSalesOrder" RENAME TO "ThirdSalesOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
