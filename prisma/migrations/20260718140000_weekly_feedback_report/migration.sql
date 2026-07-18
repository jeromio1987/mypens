-- CreateTable
CREATE TABLE "WeeklyFeedbackReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekOf" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "combinedSummary" TEXT NOT NULL,
    "healthAnalysis" TEXT NOT NULL,
    "claudeWorkAnalysis" TEXT NOT NULL,
    "wins" TEXT NOT NULL DEFAULT '[]',
    "improvements" TEXT NOT NULL DEFAULT '[]',
    "healthActions" TEXT NOT NULL DEFAULT '[]',
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "model" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyFeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyFeedbackReport_weekOf_key" ON "WeeklyFeedbackReport"("weekOf");
