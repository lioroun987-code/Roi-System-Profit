-- CreateTable
CREATE TABLE "ReconcileReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "agentSheetId" TEXT NOT NULL,
    "agentSheetName" TEXT,
    "ourSheetId" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "results" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "debug" JSONB,
    "businessUpdatedAt" TIMESTAMP(3),
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconcileReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconcileReport_businessId_idx" ON "ReconcileReport"("businessId");

-- AddForeignKey
ALTER TABLE "ReconcileReport" ADD CONSTRAINT "ReconcileReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
