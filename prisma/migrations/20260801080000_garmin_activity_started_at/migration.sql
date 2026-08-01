-- AlterTable: session start for cross-source overlap dedup (E4/E5)
ALTER TABLE "GarminActivity" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
