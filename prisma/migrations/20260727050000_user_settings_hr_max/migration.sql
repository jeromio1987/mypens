-- Optional HRmax for training-load zones; null keeps engine default (185)
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "hrMax" INTEGER;
