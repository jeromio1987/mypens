-- CreateTable
CREATE TABLE "PeriodReviewReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asOf" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "reportJson" TEXT NOT NULL DEFAULT '{}',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodReviewReport_asOf_key" ON "PeriodReviewReport"("asOf");
