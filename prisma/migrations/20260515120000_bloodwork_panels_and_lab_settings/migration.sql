-- Bloodwork ledger + lab UX flags on UserSettings

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "labsWearableContextEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN "labsLongevityLensEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BloodworkPanel" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "drawDate" TEXT NOT NULL,
    "labName" TEXT,
    "fasting" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "BloodworkPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodworkMarker" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "panelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BloodworkMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodworkPanel_drawDate_idx" ON "BloodworkPanel"("drawDate");

-- CreateIndex
CREATE INDEX "BloodworkMarker_panelId_idx" ON "BloodworkMarker"("panelId");

-- CreateIndex
CREATE INDEX "BloodworkMarker_code_idx" ON "BloodworkMarker"("code");

-- AddForeignKey
ALTER TABLE "BloodworkMarker" ADD CONSTRAINT "BloodworkMarker_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "BloodworkPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
