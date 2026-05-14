-- CreateTable
CREATE TABLE "InvestingWatchlistTicker" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvestingWatchlistTicker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroRegimeSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MacroRegimeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestingManualEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "symbol" TEXT,

    CONSTRAINT "InvestingManualEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestingWatchlistTicker_symbol_key" ON "InvestingWatchlistTicker"("symbol");

-- CreateIndex
CREATE INDEX "MacroRegimeSnapshot_effectiveDate_idx" ON "MacroRegimeSnapshot"("effectiveDate");
