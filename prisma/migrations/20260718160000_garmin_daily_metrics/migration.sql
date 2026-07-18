-- CreateTable
CREATE TABLE "GarminDailyMetric" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "sourceFile" TEXT,
    "raw" TEXT,

    CONSTRAINT "GarminDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GarminDailyMetric_kind_date_idx" ON "GarminDailyMetric"("kind", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GarminDailyMetric_date_kind_key" ON "GarminDailyMetric"("date", "kind");
