-- Web session revocation counter (bump on logout). Share-links / mobile bearer unaffected.
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
