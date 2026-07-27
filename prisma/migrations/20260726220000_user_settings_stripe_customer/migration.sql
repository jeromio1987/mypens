-- Align UserSettings with Prisma: stripeCustomerId (from manual_add-stripe-source-clubroom.sql, never applied)

ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
