-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shopifyDomain" TEXT,
    "shopifyApiKey" TEXT,
    "shopifyApiSecret" TEXT,
    "shopifyAccessToken" TEXT,
    "shopifyWebhookSecret" TEXT,
    "fbAdAccountId" TEXT,
    "fbAccessToken" TEXT,
    "googleSheetsId" TEXT,
    "googleRefreshToken" TEXT,
    "googleAccessToken" TEXT,
    "productCosts" JSONB NOT NULL DEFAULT '{}',
    "discountRules" JSONB NOT NULL DEFAULT '{}',
    "paymentSettings" JSONB NOT NULL DEFAULT '{}',
    "aiNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "rawData" JSONB NOT NULL,
    "aiAnalysis" JSONB,
    "orderSummary" TEXT,
    "paymentMethod" TEXT,
    "storePrice" DOUBLE PRECISION,
    "myCostUsd" DOUBLE PRECISION,
    "myCostIls" DOUBLE PRECISION,
    "grossProfitIls" DOUBLE PRECISION,
    "paymentFeeIls" DOUBLE PRECISION,
    "vatIls" DOUBLE PRECISION,
    "netProfitIls" DOUBLE PRECISION,
    "netProfitUsd" DOUBLE PRECISION,
    "adSpendAlloc" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "exportedToSheets" BOOLEAN NOT NULL DEFAULT false,
    "sheetsRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSpend" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "reach" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Order_businessId_shopifyOrderId_key" ON "Order"("businessId", "shopifyOrderId");
CREATE UNIQUE INDEX "AdSpend_businessId_date_key" ON "AdSpend"("businessId", "date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
