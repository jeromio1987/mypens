-- AlterTable
ALTER TABLE "HealthConnectConnection" ADD COLUMN IF NOT EXISTS "autoImportOnIngest" BOOLEAN NOT NULL DEFAULT false;
