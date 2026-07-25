-- Phase A: structured session calories for energy ledger
ALTER TABLE "TrainingEntry" ADD COLUMN IF NOT EXISTS "calories" INTEGER;

-- Optional Mifflin–St Jeor profile (energy BMR); all nullable
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "heightCm" DOUBLE PRECISION;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "birthYear" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "sex" TEXT;
