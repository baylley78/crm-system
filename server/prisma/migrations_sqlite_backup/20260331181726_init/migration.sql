-- CreateTable
CREATE TABLE "Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roleId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
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
    "firstPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "secondPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "thirdPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL NOT NULL DEFAULT 0,
    "isTailPaymentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_firstSalesUserId_fkey" FOREIGN KEY ("firstSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_legalUserId_fkey" FOREIGN KEY ("legalUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerFollowLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "nextFollowTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFollowLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerFollowLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirstSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "salesUserId" INTEGER NOT NULL,
    "orderType" TEXT NOT NULL,
    "contractAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT,
    "orderDate" DATETIME NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirstSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FirstSalesOrder_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecondSalesAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "assignedById" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecondSalesAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesAssignment_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecondSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "secondSalesUserId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "secondPaymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "performanceAmount" DECIMAL NOT NULL DEFAULT 0,
    "result" TEXT NOT NULL,
    "failReason" TEXT,
    "successNote" TEXT,
    "orderDate" DATETIME NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecondSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_secondSalesUserId_fkey" FOREIGN KEY ("secondSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecondSalesOrder_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SecondSalesAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediationCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressStatus" TEXT NOT NULL,
    "mediationResult" TEXT,
    "finishDate" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediationCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MediationCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "legalUserId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressStatus" TEXT NOT NULL,
    "caseResult" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LegalCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LegalCase_legalUserId_fkey" FOREIGN KEY ("legalUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThirdSalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "thirdSalesUserId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "paymentAmount" DECIMAL NOT NULL DEFAULT 0,
    "performanceAmount" DECIMAL NOT NULL DEFAULT 0,
    "orderDate" DATETIME NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThirdSalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThirdSalesOrder_thirdSalesUserId_fkey" FOREIGN KEY ("thirdSalesUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicantId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "approvalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL DEFAULT 0,
    "leaveDays" DECIMAL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" INTEGER,
    "approvedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Approval_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNo_key" ON "Customer"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
